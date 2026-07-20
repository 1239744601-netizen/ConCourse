-- ConCourse Student Hub activation patch
-- Run once in Supabase SQL Editor after setup Part 1 and Part 2.
-- Safe to rerun. It repairs community comments and refreshes the public
-- connected-provider allowlist without exposing LinkedIn as a verified badge.

begin;

do $$
begin
  if to_regclass('public.community_posts') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.member_profiles') is null
     or to_regclass('public.school_memberships') is null
     or to_regclass('public.user_blocks') is null
     or to_regclass('public.content_reports') is null
     or to_regprocedure('private.verified_school_key()') is null then
    raise exception 'Run supabase-setup-part-1.sql and supabase-setup-part-2.sql before this Student Hub patch';
  end if;
end;
$$;

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists community_comments_post_created_idx
  on public.community_comments (post_id, created_at) where deleted_at is null;
create index if not exists community_comments_author_created_idx
  on public.community_comments (author_id, created_at desc);

alter table public.community_comments enable row level security;
revoke all on table public.community_comments from anon, authenticated;

create or replace function public.get_post_comments(p_post_id uuid)
returns table (
  comment_id uuid,
  author_id uuid,
  author_username text,
  display_name text,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  post_author uuid;
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  select author_id into post_author from public.community_posts
  where id = p_post_id and school_key = caller_school and status = 'published' and deleted_at is null;
  if post_author is null then raise exception 'Post is unavailable'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = post_author)
       or (block.blocker_id = post_author and block.blocked_id = caller)
  ) then raise exception 'Post is unavailable'; end if;

  return query
  with recent_comments as (
    select
      comment.id,
      comment.author_id,
      profile.username,
      case when member.profile_visibility = 'school' then member.display_name else null end as safe_display_name,
      comment.body,
      comment.created_at
    from public.community_comments comment
    join public.profiles profile on profile.user_id = comment.author_id
    join public.school_memberships author_membership
      on author_membership.user_id = comment.author_id
     and author_membership.school_key = caller_school
     and author_membership.status = 'verified'
    left join public.member_profiles member on member.user_id = comment.author_id
    where comment.post_id = p_post_id
      and comment.status = 'published'
      and comment.deleted_at is null
      and not exists (
        select 1 from public.user_blocks block
        where (block.blocker_id = caller and block.blocked_id = comment.author_id)
           or (block.blocker_id = comment.author_id and block.blocked_id = caller)
      )
    order by comment.created_at desc, comment.id desc
    limit 100
  )
  select recent.id, recent.author_id, recent.username, recent.safe_display_name, recent.body, recent.created_at
  from recent_comments recent
  order by recent.created_at, recent.id;
end;
$$;

revoke all on function public.get_post_comments(uuid) from public;
grant execute on function public.get_post_comments(uuid) to authenticated;

create or replace function public.add_post_comment(p_post_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  post_author uuid;
  new_id uuid;
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 1000 then raise exception 'Comment must contain 1 to 1000 characters'; end if;
  if (select count(*) from public.community_comments where author_id = caller and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Please wait before adding another comment';
  end if;
  select author_id into post_author from public.community_posts
  where id = p_post_id and school_key = caller_school and status = 'published' and deleted_at is null;
  if post_author is null then raise exception 'Post is unavailable'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = post_author)
       or (block.blocker_id = post_author and block.blocked_id = caller)
  ) then raise exception 'Post is unavailable'; end if;

  insert into public.community_comments (post_id, author_id, body)
  values (p_post_id, caller, trim(p_body)) returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.add_post_comment(uuid, text) from public;
grant execute on function public.add_post_comment(uuid, text) to authenticated;

create or replace function public.report_community_comment(p_comment_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  new_id uuid;
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 1 and 500 then raise exception 'A report reason is required'; end if;
  if not exists (
    select 1
    from public.community_comments comment
    join public.community_posts post on post.id = comment.post_id
    where comment.id = p_comment_id
      and comment.status = 'published'
      and comment.deleted_at is null
      and post.school_key = caller_school
      and post.status = 'published'
      and post.deleted_at is null
  ) then raise exception 'Comment is unavailable'; end if;
  if exists (
    select 1 from public.content_reports
    where reporter_id = caller and target_type = 'comment' and target_id = p_comment_id
      and status in ('open', 'reviewing')
  ) then raise exception 'You already reported this comment'; end if;
  if (select count(*) from public.content_reports where reporter_id = caller and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Please wait before submitting another report';
  end if;

  insert into public.content_reports (reporter_id, target_type, target_id, reason)
  values (caller, 'comment', p_comment_id, trim(p_reason)) returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.report_community_comment(uuid, text) from public;
grant execute on function public.report_community_comment(uuid, text) to authenticated;

create or replace function public.delete_community_comment(p_comment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  update public.community_comments
  set status = 'removed', deleted_at = now()
  where id = p_comment_id and author_id = caller and deleted_at is null;
  if not found then raise exception 'Comment is unavailable'; end if;
  return true;
end;
$$;

revoke all on function public.delete_community_comment(uuid) from public;
grant execute on function public.delete_community_comment(uuid) to authenticated;

-- Only providers that ConCourse currently offers as direct account connections
-- may appear as authenticated badges. Pasted LinkedIn profile URLs remain in
-- member_profiles.linkedin_url and are deliberately separate/self-reported.
create or replace function public.get_schoolmate_connected_providers(p_user_id uuid)
returns table (
  connected_providers text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
begin
  if caller is null or caller_school is null then
    raise exception 'Verified school membership required';
  end if;
  if not exists (
    select 1
    from public.school_memberships membership
    where membership.user_id = p_user_id
      and membership.school_key = caller_school
      and membership.status = 'verified'
  ) then
    raise exception 'Campus profile is unavailable';
  end if;
  if exists (
    select 1
    from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = p_user_id)
       or (block.blocker_id = p_user_id and block.blocked_id = caller)
  ) then
    raise exception 'Campus profile is unavailable';
  end if;

  return query
  select coalesce(
    array_agg(distinct linked_identity.provider::text order by linked_identity.provider::text)
      filter (where linked_identity.provider is not null),
    '{}'::text[]
  )
  from public.profiles profile
  join public.member_profiles member on member.user_id = profile.user_id
  left join auth.identities linked_identity
    on linked_identity.user_id = profile.user_id
   and linked_identity.provider in ('google', 'github')
  where profile.user_id = p_user_id
    and (p_user_id = caller or member.profile_visibility = 'school')
  group by profile.user_id;
end;
$$;

revoke all on function public.get_schoolmate_connected_providers(uuid) from public, anon, authenticated;
grant execute on function public.get_schoolmate_connected_providers(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
select 'ConCourse comments and connected-provider badges are ready' as student_hub_patch_status;
