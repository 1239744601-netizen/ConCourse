-- ConCourse Student Hub community and messaging activation patch
-- Run in Supabase SQL Editor after supabase-setup-part-1.sql. Part 2 remains
-- optional unless the Campus Market is also being enabled.
-- Safe to rerun. It repairs community comments, cross-campus discovery,
-- private campus conversations, chat RPCs, and the public connected-provider
-- allowlist without exposing LinkedIn as a verified badge.

begin;

do $$
begin
  if to_regclass('public.community_posts') is null
     or to_regclass('public.community_post_media') is null
     or to_regclass('public.community_polls') is null
     or to_regclass('public.community_poll_options') is null
     or to_regclass('public.community_poll_votes') is null
     or to_regclass('public.post_likes') is null
     or to_regclass('public.post_bookmarks') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.member_profiles') is null
     or to_regclass('public.school_memberships') is null
     or to_regclass('public.user_blocks') is null
     or to_regclass('public.content_reports') is null
     or to_regprocedure('private.verified_school_key()') is null then
    raise exception 'Run supabase-setup-part-1.sql before this Student Hub comments and messaging patch';
  end if;
end;
$$;

-- Older Student Hub drafts did not always have the columns consumed by the
-- conversation list. Add them before compiling the chat RPCs and keep the
-- current opt-in messaging default: existing accounts are not made messageable
-- merely by applying a repair patch.
alter table public.member_profiles
  add column if not exists allow_messages boolean not null default false;
alter table public.member_profiles
  add column if not exists avatar_path text;
alter table public.member_profiles
  add column if not exists avatar_revision bigint not null default 0;
update public.member_profiles set allow_messages = false where allow_messages is null;
update public.member_profiles set avatar_revision = 0 where avatar_revision is null;
alter table public.member_profiles alter column allow_messages type boolean using allow_messages::boolean;
alter table public.member_profiles alter column avatar_path type text using avatar_path::text;
alter table public.member_profiles alter column avatar_revision type bigint using avatar_revision::bigint;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'member_profiles'
      and column_name = 'allow_messages'
      and column_default in ('true', 'true::boolean')
  ) then
    update public.member_profiles set allow_messages = false where allow_messages = true;
  end if;
end;
$$;
alter table public.member_profiles alter column allow_messages set default false;
alter table public.member_profiles alter column allow_messages set not null;
alter table public.member_profiles alter column avatar_revision set default 0;
alter table public.member_profiles alter column avatar_revision set not null;

-- Existing campus posts stay campus-only. The author must explicitly opt a
-- post into cross-campus discovery through the narrow RPC below.
alter table public.community_posts
  add column if not exists cross_campus_visible boolean not null default false;
update public.community_posts
set cross_campus_visible = false
where cross_campus_visible is null;
alter table public.community_posts alter column cross_campus_visible set default false;
alter table public.community_posts alter column cross_campus_visible set not null;

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

drop function if exists public.get_post_comments(uuid);
create or replace function public.get_post_comments(p_post_id uuid)
returns table (
  comment_id uuid,
  author_id uuid,
  author_username text,
  display_name text,
  school_name text,
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
  select post.author_id
  into post_author
  from public.community_posts as post
  join public.school_memberships post_author_membership
    on post_author_membership.user_id = post.author_id
   and post_author_membership.school_key = post.school_key
   and post_author_membership.status = 'verified'
  where post.id = p_post_id
    and (post.school_key = caller_school or post.cross_campus_visible = true)
    and post.status = 'published'
    and post.deleted_at is null;
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
      case
        when author_membership.school_key = caller_school
         and member.profile_visibility = 'school'
          then member.display_name
        else null
      end as safe_display_name,
      author_membership.school_name,
      comment.body,
      comment.created_at
    from public.community_comments comment
    join public.profiles profile on profile.user_id = comment.author_id
    join public.school_memberships author_membership
      on author_membership.user_id = comment.author_id
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
  select recent.id, recent.author_id, recent.username, recent.safe_display_name,
    recent.school_name, recent.body, recent.created_at
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
  select post.author_id into post_author
  from public.community_posts post
  join public.school_memberships author_membership
    on author_membership.user_id = post.author_id
   and author_membership.school_key = post.school_key
   and author_membership.status = 'verified'
  where post.id = p_post_id
    and (post.school_key = caller_school or post.cross_campus_visible = true)
    and post.status = 'published'
    and post.deleted_at is null;
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
    join public.school_memberships post_author_membership
      on post_author_membership.user_id = post.author_id
     and post_author_membership.school_key = post.school_key
     and post_author_membership.status = 'verified'
    join public.school_memberships comment_author_membership
      on comment_author_membership.user_id = comment.author_id
     and comment_author_membership.status = 'verified'
    where comment.id = p_comment_id
      and comment.status = 'published'
      and comment.deleted_at is null
      and (post.school_key = caller_school or post.cross_campus_visible = true)
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

-- Blocking is shared by feed and chat actions, so restore it alongside the
-- direct-message RPCs rather than leaving the conversation Block button
-- dependent on whichever version of Part 1 was installed previously.
create or replace function public.block_community_user(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if p_user_id is null or p_user_id = caller then raise exception 'Invalid user'; end if;
  if not exists (
    select 1 from public.school_memberships
    where user_id = p_user_id and status = 'verified'
  ) then raise exception 'User is not a verified ConCourse member'; end if;
  insert into public.user_blocks (blocker_id, blocked_id)
  values (caller, p_user_id) on conflict do nothing;
  return true;
end;
$$;

revoke all on function public.block_community_user(uuid) from public;
grant execute on function public.block_community_user(uuid) to authenticated;

-- Cross-campus discovery is read-only for publishing: verified members may
-- discover and interact with opted-in posts from other verified universities,
-- while publish_community_post* continues to derive its school from the caller.
drop index if exists public.community_posts_discovery_created_idx;
create index community_posts_discovery_created_idx
  on public.community_posts (created_at desc, id desc)
  where cross_campus_visible = true and status = 'published' and deleted_at is null;

create or replace function public.can_view_community_media(p_owner_id text, p_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(p_owner_id = (select auth.uid())::text, false)
    or exists (
      select 1
      from public.community_post_media media
      join public.community_posts post
        on post.id = media.post_id
       and post.status = 'published'
       and post.deleted_at is null
      join public.school_memberships viewer
        on viewer.user_id = (select auth.uid())
       and viewer.status = 'verified'
      join public.school_memberships author_membership
        on author_membership.user_id = post.author_id
       and author_membership.school_key = post.school_key
       and author_membership.status = 'verified'
      where media.owner_id::text = p_owner_id
        and media.storage_path = p_object_path
        and media.owner_id = post.author_id
        and (viewer.school_key = post.school_key or post.cross_campus_visible = true)
        and not exists (
          select 1
          from public.user_blocks block
          where (block.blocker_id = viewer.user_id and block.blocked_id = post.author_id)
             or (block.blocker_id = post.author_id and block.blocked_id = viewer.user_id)
        )
    );
$$;

revoke all on function public.can_view_community_media(text, text) from public, anon, authenticated;
grant execute on function public.can_view_community_media(text, text) to authenticated;

drop function if exists public.get_cross_school_feed(integer, integer, boolean, uuid);
create or replace function public.get_cross_school_feed(
  p_limit integer default 30,
  p_offset integer default 0,
  p_bookmarked_only boolean default false,
  p_post_id uuid default null
)
returns table (
  post_id uuid,
  author_id uuid,
  author_username text,
  display_name text,
  avatar_path text,
  avatar_revision bigint,
  major_of_study text,
  school_key text,
  school_name text,
  body text,
  tags text[],
  media jsonb,
  poll jsonb,
  created_at timestamptz,
  like_count bigint,
  comment_count bigint,
  liked_by_me boolean,
  bookmarked_by_me boolean
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
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;

  return query
  select
    post.id,
    post.author_id,
    profile.username,
    null::text,
    null::text,
    null::bigint,
    null::text,
    post.school_key,
    author_membership.school_name,
    post.body,
    post.tags,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'storage_path', attachment.storage_path,
            'media_type', attachment.media_type,
            'mime_type', attachment.mime_type,
            'alt_text', attachment.alt_text,
            'position', attachment.position
          )
          order by attachment.position
        )
        from public.community_post_media attachment
        where attachment.post_id = post.id
          and attachment.owner_id = post.author_id
      ),
      '[]'::jsonb
    ),
    (
      select jsonb_build_object(
        'poll_id', community_poll.id,
        'question', community_poll.question,
        'total_votes', (
          select count(*) from public.community_poll_votes poll_vote
          where poll_vote.poll_id = community_poll.id
        ),
        'selected_option_id', (
          select poll_vote.option_id
          from public.community_poll_votes poll_vote
          where poll_vote.poll_id = community_poll.id and poll_vote.user_id = caller
        ),
        'options', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'option_id', poll_option.id,
                'label', poll_option.label,
                'vote_count', (
                  select count(*)
                  from public.community_poll_votes option_vote
                  where option_vote.poll_id = community_poll.id
                    and option_vote.option_id = poll_option.id
                )
              )
              order by poll_option.position
            )
            from public.community_poll_options poll_option
            where poll_option.poll_id = community_poll.id
          ),
          '[]'::jsonb
        )
      )
      from public.community_polls community_poll
      where community_poll.post_id = post.id
    ),
    post.created_at,
    (select count(*) from public.post_likes likes where likes.post_id = post.id),
    (
      select count(*)
      from public.community_comments comments
      join public.school_memberships comment_membership
        on comment_membership.user_id = comments.author_id
       and comment_membership.status = 'verified'
      where comments.post_id = post.id
        and comments.status = 'published'
        and comments.deleted_at is null
        and not exists (
          select 1 from public.user_blocks comment_block
          where (comment_block.blocker_id = caller and comment_block.blocked_id = comments.author_id)
             or (comment_block.blocker_id = comments.author_id and comment_block.blocked_id = caller)
        )
    ),
    exists (select 1 from public.post_likes mine where mine.post_id = post.id and mine.user_id = caller),
    exists (select 1 from public.post_bookmarks saved where saved.post_id = post.id and saved.user_id = caller)
  from public.community_posts post
  join public.profiles profile on profile.user_id = post.author_id
  join public.school_memberships author_membership
    on author_membership.user_id = post.author_id
   and author_membership.school_key = post.school_key
   and author_membership.status = 'verified'
  where post.school_key <> caller_school
    and post.cross_campus_visible = true
    and post.status = 'published'
    and post.deleted_at is null
    and (p_post_id is null or post.id = p_post_id)
    and (
      not coalesce(p_bookmarked_only, false)
      or exists (
        select 1 from public.post_bookmarks saved_filter
        where saved_filter.post_id = post.id and saved_filter.user_id = caller
      )
    )
    and not exists (
      select 1 from public.user_blocks block
      where (block.blocker_id = caller and block.blocked_id = post.author_id)
         or (block.blocker_id = post.author_id and block.blocked_id = caller)
    )
  order by post.created_at desc, post.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.get_cross_school_feed(integer, integer, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.get_cross_school_feed(integer, integer, boolean, uuid)
  to authenticated;

create or replace function public.set_community_post_cross_campus(
  p_post_id uuid,
  p_visible boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if p_post_id is null or p_visible is null then raise exception 'Post visibility is required'; end if;

  update public.community_posts post
  set cross_campus_visible = p_visible,
      updated_at = now()
  where post.id = p_post_id
    and post.author_id = caller
    and post.school_key = caller_school
    and post.status = 'published'
    and post.deleted_at is null;
  if not found then raise exception 'Post is unavailable'; end if;
  return p_visible;
end;
$$;

revoke all on function public.set_community_post_cross_campus(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_community_post_cross_campus(uuid, boolean)
  to authenticated;

create or replace function public.toggle_post_like(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  post_author uuid;
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  select post.author_id into post_author
  from public.community_posts post
  join public.school_memberships author_membership
    on author_membership.user_id = post.author_id
   and author_membership.school_key = post.school_key
   and author_membership.status = 'verified'
  where post.id = p_post_id
    and (post.school_key = caller_school or post.cross_campus_visible = true)
    and post.status = 'published'
    and post.deleted_at is null;
  if post_author is null then raise exception 'Post is unavailable'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = post_author)
       or (block.blocker_id = post_author and block.blocked_id = caller)
  ) then raise exception 'Post is unavailable'; end if;

  delete from public.post_likes where post_id = p_post_id and user_id = caller;
  if found then return false; end if;
  insert into public.post_likes (post_id, user_id) values (p_post_id, caller);
  return true;
end;
$$;

revoke all on function public.toggle_post_like(uuid) from public, anon, authenticated;
grant execute on function public.toggle_post_like(uuid) to authenticated;

create or replace function public.toggle_post_bookmark(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  post_author uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;

  select post.author_id into post_author
  from public.community_posts post
  join public.school_memberships author_membership
    on author_membership.user_id = post.author_id
   and author_membership.school_key = post.school_key
   and author_membership.status = 'verified'
  where post.id = p_post_id
    and (post.school_key = caller_school or post.cross_campus_visible = true)
    and post.status = 'published'
    and post.deleted_at is null;
  if post_author is null then raise exception 'Post is unavailable'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = post_author)
       or (block.blocker_id = post_author and block.blocked_id = caller)
  ) then raise exception 'Post is unavailable'; end if;

  delete from public.post_bookmarks where post_id = p_post_id and user_id = caller;
  if found then return false; end if;
  insert into public.post_bookmarks (post_id, user_id) values (p_post_id, caller);
  return true;
end;
$$;

revoke all on function public.toggle_post_bookmark(uuid) from public, anon, authenticated;
grant execute on function public.toggle_post_bookmark(uuid) to authenticated;

create or replace function public.report_community_post(p_post_id uuid, p_reason text)
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
    from public.community_posts post
    join public.school_memberships author_membership
      on author_membership.user_id = post.author_id
     and author_membership.school_key = post.school_key
     and author_membership.status = 'verified'
    where post.id = p_post_id
      and (post.school_key = caller_school or post.cross_campus_visible = true)
      and post.status = 'published'
      and post.deleted_at is null
  ) then raise exception 'Post is unavailable'; end if;
  if exists (
    select 1 from public.content_reports
    where reporter_id = caller and target_type = 'post' and target_id = p_post_id
      and status in ('open', 'reviewing')
  ) then raise exception 'You already reported this post'; end if;
  if (select count(*) from public.content_reports where reporter_id = caller and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Please wait before submitting another report';
  end if;
  insert into public.content_reports (reporter_id, target_type, target_id, reason)
  values (caller, 'post', p_post_id, trim(p_reason)) returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.report_community_post(uuid, text) from public, anon, authenticated;
grant execute on function public.report_community_post(uuid, text) to authenticated;

-- Direct campus conversations. Tables remain inaccessible through ordinary
-- REST table operations; authenticated clients use the participant-checking
-- security-definer RPCs below. Messages are private, but not end-to-end
-- encrypted because trusted database administrators can access them.
create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  school_key text not null,
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (school_key, user_low, user_high),
  check (user_low <> user_high)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  client_nonce uuid not null,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  unique (sender_id, client_nonce)
);

create index if not exists direct_conversations_low_idx
  on public.direct_conversations (user_low, created_at desc);
create index if not exists direct_conversations_high_idx
  on public.direct_conversations (user_high, created_at desc);
create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages (conversation_id, created_at);
create index if not exists direct_messages_sender_created_idx
  on public.direct_messages (sender_id, created_at desc);

alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;
revoke all on table public.direct_conversations from anon, authenticated;
revoke all on table public.direct_messages from anon, authenticated;

create or replace function public.start_direct_conversation(p_username text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  target_user uuid;
  low_user uuid;
  high_user uuid;
  conversation uuid;
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  select profile.user_id into target_user
  from public.profiles profile
  join public.school_memberships membership on membership.user_id = profile.user_id
  left join public.member_profiles member on member.user_id = profile.user_id
  where profile.username = trim(p_username)
    and membership.school_key = caller_school
    and membership.status = 'verified'
    and coalesce(member.allow_messages, false) = true;

  if target_user is null then raise exception 'No messageable schoolmate has that username'; end if;
  if target_user = caller then raise exception 'You cannot message yourself'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = target_user)
       or (block.blocker_id = target_user and block.blocked_id = caller)
  ) then raise exception 'Messaging is unavailable because one participant blocked the other'; end if;

  if caller::text < target_user::text then low_user := caller; high_user := target_user;
  else low_user := target_user; high_user := caller; end if;

  insert into public.direct_conversations (school_key, user_low, user_high, created_by)
  values (caller_school, low_user, high_user, caller)
  on conflict (school_key, user_low, user_high) do update set school_key = excluded.school_key
  returning id into conversation;
  return conversation;
end;
$$;

revoke all on function public.start_direct_conversation(text) from public;
grant execute on function public.start_direct_conversation(text) to authenticated;

-- The avatar columns changed this RPC's return type after its first release,
-- so an explicit drop is required when repairing an older installation.
drop function if exists public.get_my_conversations();
create or replace function public.get_my_conversations()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_username text,
  other_display_name text,
  other_avatar_path text,
  other_avatar_revision bigint,
  last_message text,
  last_message_at timestamptz
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
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  return query
  with mine as (
    select
      conversation.id,
      case when conversation.user_low = caller then conversation.user_high else conversation.user_low end as other_id,
      conversation.created_at
    from public.direct_conversations conversation
    where conversation.school_key = caller_school
      and (conversation.user_low = caller or conversation.user_high = caller)
  )
  select
    mine.id,
    mine.other_id,
    profile.username,
    case when member.profile_visibility = 'school' then member.display_name else null end,
    case when member.profile_visibility = 'school' then member.avatar_path else null end,
    case when member.profile_visibility = 'school' then member.avatar_revision else null end,
    latest.body,
    latest.created_at
  from mine
  join public.profiles profile on profile.user_id = mine.other_id
  join public.school_memberships other_membership
    on other_membership.user_id = mine.other_id
   and other_membership.school_key = caller_school
   and other_membership.status = 'verified'
  left join public.member_profiles member on member.user_id = mine.other_id
  left join lateral (
    select message.body, message.created_at
    from public.direct_messages message
    where message.conversation_id = mine.id and message.deleted_at is null
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  where not exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = mine.other_id)
       or (block.blocker_id = mine.other_id and block.blocked_id = caller)
  )
  order by coalesce(latest.created_at, mine.created_at) desc, mine.id desc;
end;
$$;

revoke all on function public.get_my_conversations() from public;
grant execute on function public.get_my_conversations() to authenticated;

create or replace function public.get_conversation_messages(p_conversation_id uuid, p_limit integer default 100)
returns table (
  message_id uuid,
  sender_id uuid,
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
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if not exists (
    select 1 from public.direct_conversations conversation
    where conversation.id = p_conversation_id
      and conversation.school_key = caller_school
      and (conversation.user_low = caller or conversation.user_high = caller)
      and not exists (
        select 1 from public.user_blocks block
        where (
          block.blocker_id = caller
          and block.blocked_id = case when conversation.user_low = caller then conversation.user_high else conversation.user_low end
        ) or (
          block.blocked_id = caller
          and block.blocker_id = case when conversation.user_low = caller then conversation.user_high else conversation.user_low end
        )
      )
  ) then raise exception 'Conversation is unavailable'; end if;

  return query
  with recent_messages as (
    select message.id, message.sender_id, message.body, message.created_at
    from public.direct_messages message
    where message.conversation_id = p_conversation_id and message.deleted_at is null
    order by message.created_at desc, message.id desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200)
  )
  select recent.id, recent.sender_id, recent.body, recent.created_at
  from recent_messages recent
  order by recent.created_at, recent.id;
end;
$$;

revoke all on function public.get_conversation_messages(uuid, integer) from public;
grant execute on function public.get_conversation_messages(uuid, integer) to authenticated;

create or replace function public.send_direct_message(
  p_conversation_id uuid,
  p_body text,
  p_client_nonce uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  other_user uuid;
  new_id uuid;
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 2000 then raise exception 'Message must contain 1 to 2000 characters'; end if;
  if p_client_nonce is null then raise exception 'Message identifier is required'; end if;
  if (select count(*) from public.direct_messages where sender_id = caller and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Please wait before sending another message';
  end if;

  select case when conversation.user_low = caller then conversation.user_high else conversation.user_low end
  into other_user
  from public.direct_conversations conversation
  where conversation.id = p_conversation_id
    and conversation.school_key = caller_school
    and (conversation.user_low = caller or conversation.user_high = caller);
  if other_user is null then raise exception 'Conversation is unavailable'; end if;
  if not exists (
    select 1 from public.school_memberships membership
    where membership.user_id = other_user
      and membership.school_key = caller_school
      and membership.status = 'verified'
  ) then raise exception 'This schoolmate is no longer available for messaging'; end if;
  if not exists (
    select 1 from public.member_profiles member
    where member.user_id = other_user and member.allow_messages = true
  ) then raise exception 'This schoolmate is not accepting messages'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = other_user)
       or (block.blocker_id = other_user and block.blocked_id = caller)
  ) then raise exception 'Messaging is unavailable because one participant blocked the other'; end if;

  insert into public.direct_messages (conversation_id, sender_id, client_nonce, body)
  values (p_conversation_id, caller, p_client_nonce, trim(p_body))
  on conflict (sender_id, client_nonce) do update set body = public.direct_messages.body
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.send_direct_message(uuid, text, uuid) from public;
grant execute on function public.send_direct_message(uuid, text, uuid) to authenticated;

create or replace function public.report_conversation_user(p_conversation_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  other_user uuid;
  new_id uuid;
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 1 and 500 then raise exception 'A report reason is required'; end if;
  select case when conversation.user_low = caller then conversation.user_high else conversation.user_low end
  into other_user
  from public.direct_conversations conversation
  where conversation.id = p_conversation_id
    and conversation.school_key = caller_school
    and (conversation.user_low = caller or conversation.user_high = caller);
  if other_user is null then raise exception 'Conversation is unavailable'; end if;

  if exists (
    select 1 from public.content_reports
    where reporter_id = caller and target_type = 'user' and target_id = other_user
      and status in ('open', 'reviewing')
  ) then raise exception 'You already reported this user'; end if;
  if (select count(*) from public.content_reports where reporter_id = caller and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Please wait before submitting another report';
  end if;

  insert into public.content_reports (reporter_id, target_type, target_id, reason)
  values (caller, 'user', other_user, trim(p_reason)) returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.report_conversation_user(uuid, text) from public;
grant execute on function public.report_conversation_user(uuid, text) to authenticated;

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
select 'ConCourse comments, cross-campus discovery, private messaging, and connected-provider badges are ready' as student_hub_patch_status;
