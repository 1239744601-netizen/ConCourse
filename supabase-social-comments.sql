-- ConCourse social comments migration
-- Run after supabase-setup-part-1.sql and supabase-setup-part-2.sql.
-- This migration is safe to rerun.
--
-- Adds:
--   * one-level replies and likes for campus-community comments
--   * public listing comments, replies, and likes for the campus marketplace
--
-- All browser access remains RPC-only. The underlying tables have RLS enabled
-- and no grants for anon or authenticated users.

-- ---------------------------------------------------------------------------
-- Campus-community comment replies and likes
-- ---------------------------------------------------------------------------

alter table public.community_comments
  add column if not exists parent_comment_id uuid;

alter table public.community_comments
  drop constraint if exists community_comments_parent_comment_fk;
alter table public.community_comments
  add constraint community_comments_parent_comment_fk
  foreign key (parent_comment_id)
  references public.community_comments(id)
  on delete cascade;

alter table public.community_comments
  drop constraint if exists community_comments_not_own_parent;
alter table public.community_comments
  add constraint community_comments_not_own_parent
  check (parent_comment_id is null or parent_comment_id <> id);

create index if not exists community_comments_parent_created_idx
  on public.community_comments (parent_comment_id, created_at, id)
  where parent_comment_id is not null and deleted_at is null;

create table if not exists public.community_comment_likes (
  comment_id uuid not null
    references public.community_comments(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists community_comment_likes_user_created_idx
  on public.community_comment_likes (user_id, created_at desc);

alter table public.community_comment_likes enable row level security;
revoke all on table public.community_comment_likes
  from public, anon, authenticated;

create or replace function private.enforce_community_comment_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_row public.community_comments%rowtype;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select parent.*
  into parent_row
  from public.community_comments parent
  where parent.id = new.parent_comment_id;

  if not found
     or parent_row.post_id <> new.post_id
     or parent_row.status <> 'published'
     or parent_row.deleted_at is not null then
    raise exception 'Parent comment is unavailable';
  end if;

  -- A single reply level keeps the thread readable and prevents cycles.
  if parent_row.parent_comment_id is not null then
    raise exception 'Replies can only be added to a top-level comment';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_community_comment_parent()
  from public, anon, authenticated;

drop trigger if exists community_comments_validate_parent
  on public.community_comments;
create trigger community_comments_validate_parent
  before insert or update of post_id, parent_comment_id
  on public.community_comments
  for each row execute procedure private.enforce_community_comment_parent();

drop function if exists public.get_post_comments(uuid);
create function public.get_post_comments(p_post_id uuid)
returns table (
  comment_id uuid,
  parent_comment_id uuid,
  author_id uuid,
  author_username text,
  display_name text,
  school_name text,
  parent_author_id uuid,
  parent_author_username text,
  parent_author_display_name text,
  parent_author_school_name text,
  body text,
  created_at timestamptz,
  like_count bigint,
  liked_by_me boolean,
  reply_count bigint
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
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if caller_school is null then
    raise exception 'Verified school membership required';
  end if;

  select post.author_id
  into post_author
  from public.community_posts post
  join public.school_memberships post_author_membership
    on post_author_membership.user_id = post.author_id
   and post_author_membership.school_key = post.school_key
   and post_author_membership.status = 'verified'
  where post.id = p_post_id
    and (
      post.school_key = caller_school
      or post.cross_campus_visible = true
    )
    and post.status = 'published'
    and post.deleted_at is null;

  if post_author is null then
    raise exception 'Post is unavailable';
  end if;
  if exists (
    select 1
    from public.user_blocks block
    where (
      block.blocker_id = caller
      and block.blocked_id = post_author
    ) or (
      block.blocker_id = post_author
      and block.blocked_id = caller
    )
  ) then
    raise exception 'Post is unavailable';
  end if;

  return query
  with visible_comments as (
    select
      comment.id,
      comment.parent_comment_id,
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
    join public.profiles profile
      on profile.user_id = comment.author_id
    join public.school_memberships author_membership
      on author_membership.user_id = comment.author_id
     and author_membership.status = 'verified'
    left join public.member_profiles member
      on member.user_id = comment.author_id
    where comment.post_id = p_post_id
      and comment.status = 'published'
      and comment.deleted_at is null
      and not exists (
        select 1
        from public.user_blocks block
        where (
          block.blocker_id = caller
          and block.blocked_id = comment.author_id
        ) or (
          block.blocker_id = comment.author_id
          and block.blocked_id = caller
        )
      )
  ),
  threaded_comments as (
    select
      comment.*,
      parent.author_id as parent_author_id,
      parent.username as parent_author_username,
      parent.safe_display_name as parent_author_display_name,
      parent.school_name as parent_author_school_name,
      parent.created_at as parent_created_at
    from visible_comments comment
    left join visible_comments parent
      on parent.id = comment.parent_comment_id
  )
  select
    comment.id,
    comment.parent_comment_id,
    comment.author_id,
    comment.username,
    comment.safe_display_name,
    comment.school_name,
    comment.parent_author_id,
    comment.parent_author_username,
    comment.parent_author_display_name,
    comment.parent_author_school_name,
    comment.body,
    comment.created_at,
    (
      select count(*)
      from public.community_comment_likes comment_like
      where comment_like.comment_id = comment.id
    )::bigint,
    exists (
      select 1
      from public.community_comment_likes comment_like
      where comment_like.comment_id = comment.id
        and comment_like.user_id = caller
    ),
    (
      select count(*)
      from threaded_comments reply
      where reply.parent_comment_id = comment.id
    )::bigint
  from threaded_comments comment
  order by
    coalesce(comment.parent_created_at, comment.created_at),
    coalesce(comment.parent_comment_id, comment.id),
    (comment.parent_comment_id is not null),
    comment.created_at,
    comment.id;
end;
$$;

revoke all on function public.get_post_comments(uuid)
  from public, anon, authenticated;
grant execute on function public.get_post_comments(uuid)
  to authenticated;

-- Keep the existing two-argument call working while exposing the reply-aware
-- three-argument form to PostgREST.
drop function if exists public.add_post_comment(uuid, text, uuid);
create function public.add_post_comment(
  p_post_id uuid,
  p_body text,
  p_parent_comment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  post_author uuid;
  parent_author uuid;
  new_id uuid;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if caller_school is null then
    raise exception 'Verified school membership required';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'Comment must contain 1 to 1000 characters';
  end if;
  if (
    select count(*)
    from public.community_comments comment
    where comment.author_id = caller
      and comment.created_at > now() - interval '1 minute'
  ) >= 10 then
    raise exception 'Please wait before adding another comment';
  end if;
  if (
    select count(*)
    from public.community_comments comment
    where comment.author_id = caller
      and comment.created_at > now() - interval '1 hour'
  ) >= 100 then
    raise exception 'Hourly comment limit reached';
  end if;

  select post.author_id
  into post_author
  from public.community_posts post
  join public.school_memberships post_author_membership
    on post_author_membership.user_id = post.author_id
   and post_author_membership.school_key = post.school_key
   and post_author_membership.status = 'verified'
  where post.id = p_post_id
    and (
      post.school_key = caller_school
      or post.cross_campus_visible = true
    )
    and post.status = 'published'
    and post.deleted_at is null;

  if post_author is null then
    raise exception 'Post is unavailable';
  end if;
  if exists (
    select 1
    from public.user_blocks block
    where (
      block.blocker_id = caller
      and block.blocked_id = post_author
    ) or (
      block.blocker_id = post_author
      and block.blocked_id = caller
    )
  ) then
    raise exception 'Post is unavailable';
  end if;

  if p_parent_comment_id is not null then
    select parent.author_id
    into parent_author
    from public.community_comments parent
    join public.school_memberships parent_membership
      on parent_membership.user_id = parent.author_id
     and parent_membership.status = 'verified'
    where parent.id = p_parent_comment_id
      and parent.post_id = p_post_id
      and parent.parent_comment_id is null
      and parent.status = 'published'
      and parent.deleted_at is null;

    if parent_author is null then
      raise exception 'Parent comment is unavailable';
    end if;
    if exists (
      select 1
      from public.user_blocks block
      where (
        block.blocker_id = caller
        and block.blocked_id = parent_author
      ) or (
        block.blocker_id = parent_author
        and block.blocked_id = caller
      )
    ) then
      raise exception 'Parent comment is unavailable';
    end if;
  end if;

  insert into public.community_comments (
    post_id,
    author_id,
    parent_comment_id,
    body
  ) values (
    p_post_id,
    caller,
    p_parent_comment_id,
    trim(p_body)
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.add_post_comment(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.add_post_comment(uuid, text, uuid)
  to authenticated;

create or replace function public.add_post_comment(
  p_post_id uuid,
  p_body text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.add_post_comment(p_post_id, p_body, null::uuid);
$$;

revoke all on function public.add_post_comment(uuid, text)
  from public, anon, authenticated;
grant execute on function public.add_post_comment(uuid, text)
  to authenticated;

-- Soft-deleting a top-level comment also hides its direct replies. This keeps
-- one-level threads coherent without permanently deleting moderation records.
create or replace function public.delete_community_comment(
  p_comment_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_parent uuid;
begin
  select comment.parent_comment_id
  into target_parent
  from public.community_comments comment
  where comment.id = p_comment_id
    and comment.author_id = caller
    and comment.deleted_at is null;

  if not found then
    raise exception 'Comment is unavailable';
  end if;

  update public.community_comments comment
  set
    status = 'removed',
    deleted_at = now()
  where comment.deleted_at is null
    and (
      comment.id = p_comment_id
      or (
        target_parent is null
        and comment.parent_comment_id = p_comment_id
      )
    );

  return true;
end;
$$;

revoke all on function public.delete_community_comment(uuid)
  from public, anon, authenticated;
grant execute on function public.delete_community_comment(uuid)
  to authenticated;

create or replace function public.toggle_community_comment_like(
  p_comment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  comment_author uuid;
  post_author uuid;
  is_liked boolean;
  total_likes bigint;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if caller_school is null then
    raise exception 'Verified school membership required';
  end if;

  select comment.author_id, post.author_id
  into comment_author, post_author
  from public.community_comments comment
  join public.community_posts post
    on post.id = comment.post_id
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
    and (
      post.school_key = caller_school
      or post.cross_campus_visible = true
    )
    and post.status = 'published'
    and post.deleted_at is null;

  if comment_author is null then
    raise exception 'Comment is unavailable';
  end if;
  if exists (
    select 1
    from public.user_blocks block
    where (
      block.blocker_id = caller
      and block.blocked_id in (post_author, comment_author)
    ) or (
      block.blocked_id = caller
      and block.blocker_id in (post_author, comment_author)
    )
  ) then
    raise exception 'Comment is unavailable';
  end if;

  delete from public.community_comment_likes comment_like
  where comment_like.comment_id = p_comment_id
    and comment_like.user_id = caller;

  if found then
    is_liked := false;
  else
    insert into public.community_comment_likes (comment_id, user_id)
    values (p_comment_id, caller);
    is_liked := true;
  end if;

  select count(*)::bigint
  into total_likes
  from public.community_comment_likes comment_like
  where comment_like.comment_id = p_comment_id;

  return jsonb_build_object(
    'comment_id', p_comment_id,
    'liked', is_liked,
    'like_count', total_likes
  );
end;
$$;

revoke all on function public.toggle_community_comment_like(uuid)
  from public, anon, authenticated;
grant execute on function public.toggle_community_comment_like(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Campus-marketplace listing comments and likes
-- ---------------------------------------------------------------------------

create table if not exists public.marketplace_listing_comments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null
    references public.marketplace_listings(id) on delete cascade,
  author_id uuid not null
    references auth.users(id) on delete cascade,
  parent_comment_id uuid,
  body text not null
    check (
      body = trim(body)
      and char_length(body) between 1 and 1000
    ),
  status text not null default 'published'
    check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.marketplace_listing_comments
  drop constraint if exists marketplace_listing_comments_parent_comment_fk;
alter table public.marketplace_listing_comments
  add constraint marketplace_listing_comments_parent_comment_fk
  foreign key (parent_comment_id)
  references public.marketplace_listing_comments(id)
  on delete cascade;

alter table public.marketplace_listing_comments
  drop constraint if exists marketplace_listing_comments_not_own_parent;
alter table public.marketplace_listing_comments
  add constraint marketplace_listing_comments_not_own_parent
  check (parent_comment_id is null or parent_comment_id <> id);

create table if not exists public.marketplace_listing_comment_likes (
  comment_id uuid not null
    references public.marketplace_listing_comments(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists marketplace_listing_comments_listing_created_idx
  on public.marketplace_listing_comments (listing_id, created_at, id)
  where deleted_at is null;
create index if not exists marketplace_listing_comments_parent_created_idx
  on public.marketplace_listing_comments (parent_comment_id, created_at, id)
  where parent_comment_id is not null and deleted_at is null;
create index if not exists marketplace_listing_comments_author_created_idx
  on public.marketplace_listing_comments (author_id, created_at desc);
create index if not exists marketplace_listing_comment_likes_user_created_idx
  on public.marketplace_listing_comment_likes (user_id, created_at desc);

alter table public.marketplace_listing_comments enable row level security;
alter table public.marketplace_listing_comment_likes enable row level security;
revoke all on table public.marketplace_listing_comments
  from public, anon, authenticated;
revoke all on table public.marketplace_listing_comment_likes
  from public, anon, authenticated;

create or replace function private.can_view_marketplace_listing_comments(
  p_listing_id uuid,
  p_viewer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.marketplace_listings listing
    join public.school_memberships seller_membership
      on seller_membership.user_id = listing.seller_id
     and seller_membership.school_key = listing.school_key
     and seller_membership.status = 'verified'
    join public.school_memberships viewer_membership
      on viewer_membership.user_id = p_viewer_id
     and viewer_membership.status = 'verified'
    where listing.id = p_listing_id
      and (
        (
          listing.school_key = viewer_membership.school_key
          and listing.status in ('active', 'reserved')
        )
        or (
          listing.school_key <> viewer_membership.school_key
          and listing.global_visible = true
          and listing.status = 'active'
        )
      )
      and not exists (
        select 1
        from public.user_blocks block
        where (
          block.blocker_id = p_viewer_id
          and block.blocked_id = listing.seller_id
        ) or (
          block.blocker_id = listing.seller_id
          and block.blocked_id = p_viewer_id
        )
      )
  );
$$;

revoke all on function private.can_view_marketplace_listing_comments(uuid, uuid)
  from public, anon, authenticated;

create or replace function private.enforce_marketplace_listing_comment_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_row public.marketplace_listing_comments%rowtype;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select parent.*
  into parent_row
  from public.marketplace_listing_comments parent
  where parent.id = new.parent_comment_id;

  if not found
     or parent_row.listing_id <> new.listing_id
     or parent_row.status <> 'published'
     or parent_row.deleted_at is not null then
    raise exception 'Parent comment is unavailable';
  end if;
  if parent_row.parent_comment_id is not null then
    raise exception 'Replies can only be added to a top-level comment';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_marketplace_listing_comment_parent()
  from public, anon, authenticated;

drop trigger if exists marketplace_listing_comments_validate_parent
  on public.marketplace_listing_comments;
create trigger marketplace_listing_comments_validate_parent
  before insert or update of listing_id, parent_comment_id
  on public.marketplace_listing_comments
  for each row
  execute procedure private.enforce_marketplace_listing_comment_parent();

drop function if exists public.get_marketplace_listing_comments(uuid, integer, integer);
create function public.get_marketplace_listing_comments(
  p_listing_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  listing_seller uuid;
  seller_username text;
  can_contact_seller boolean := false;
  item_rows jsonb;
  total_count bigint := 0;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if caller_school is null then
    raise exception 'Verified school membership required';
  end if;
  if not private.can_view_marketplace_listing_comments(p_listing_id, caller) then
    raise exception 'Listing is unavailable';
  end if;

  select listing.seller_id, profile.username
  into listing_seller, seller_username
  from public.marketplace_listings listing
  join public.profiles profile
    on profile.user_id = listing.seller_id
  where listing.id = p_listing_id;

  can_contact_seller := caller <> listing_seller
    and exists (
      select 1
      from public.member_profiles caller_profile
      where caller_profile.user_id = caller
        and caller_profile.allow_messages = true
    )
    and exists (
      select 1
      from public.member_profiles seller_profile
      where seller_profile.user_id = listing_seller
        and seller_profile.allow_messages = true
    );

  with visible_comments as (
    select
      comment.id,
      comment.parent_comment_id,
      comment.author_id,
      profile.username,
      case
        when membership.school_key = caller_school
         and member.profile_visibility = 'school'
          then member.display_name
        else null
      end as safe_display_name,
      case
        when membership.school_key = caller_school
         and member.profile_visibility = 'school'
          then member.avatar_path
        else null
      end as safe_avatar_path,
      case
        when membership.school_key = caller_school
         and member.profile_visibility = 'school'
          then member.avatar_revision
        else null
      end as safe_avatar_revision,
      membership.school_name,
      comment.body,
      comment.created_at
    from public.marketplace_listing_comments comment
    join public.profiles profile
      on profile.user_id = comment.author_id
    join public.school_memberships membership
      on membership.user_id = comment.author_id
     and membership.status = 'verified'
    left join public.member_profiles member
      on member.user_id = comment.author_id
    where comment.listing_id = p_listing_id
      and comment.status = 'published'
      and comment.deleted_at is null
      and not exists (
        select 1
        from public.user_blocks block
        where (
          block.blocker_id = caller
          and block.blocked_id = comment.author_id
        ) or (
          block.blocker_id = comment.author_id
          and block.blocked_id = caller
        )
      )
  ),
  threaded_comments as (
    select
      comment.*,
      parent.author_id as parent_author_id,
      parent.username as parent_author_username,
      parent.safe_display_name as parent_author_display_name,
      parent.school_name as parent_author_school_name,
      parent.created_at as parent_created_at
    from visible_comments comment
    left join visible_comments parent
      on parent.id = comment.parent_comment_id
  ),
  ordered_comments as (
    select
      comment.*,
      row_number() over (
        order by
          coalesce(comment.parent_created_at, comment.created_at),
          coalesce(comment.parent_comment_id, comment.id),
          (comment.parent_comment_id is not null),
          comment.created_at,
          comment.id
      ) as position
    from threaded_comments comment
  ),
  page_comments as (
    select *
    from ordered_comments
    order by position
    limit safe_limit
    offset safe_offset
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'comment_id', comment.id,
          'listing_id', p_listing_id,
          'parent_comment_id', comment.parent_comment_id,
          'author', jsonb_build_object(
            'user_id', comment.author_id,
            'username', comment.username,
            'display_name', comment.safe_display_name,
            'avatar_path', comment.safe_avatar_path,
            'avatar_revision', comment.safe_avatar_revision,
            'school_name', comment.school_name
          ),
          'parent_author', case
            when comment.parent_author_id is null then null
            else jsonb_build_object(
              'user_id', comment.parent_author_id,
              'username', comment.parent_author_username,
              'display_name', comment.parent_author_display_name,
              'school_name', comment.parent_author_school_name
            )
          end,
          'body', comment.body,
          'created_at', comment.created_at,
          'like_count', (
            select count(*)
            from public.marketplace_listing_comment_likes comment_like
            where comment_like.comment_id = comment.id
          ),
          'liked_by_me', exists (
            select 1
            from public.marketplace_listing_comment_likes comment_like
            where comment_like.comment_id = comment.id
              and comment_like.user_id = caller
          ),
          'reply_count', (
            select count(*)
            from threaded_comments reply
            where reply.parent_comment_id = comment.id
          ),
          'can_delete', comment.author_id = caller
        )
        order by comment.position
      ),
      '[]'::jsonb
    ),
    (
      select count(*)::bigint
      from threaded_comments
    )
  into item_rows, total_count
  from page_comments comment;

  return jsonb_build_object(
    'items', coalesce(item_rows, '[]'::jsonb),
    'comment_count', coalesce(total_count, 0),
    'limit', safe_limit,
    'offset', safe_offset,
    'has_more', safe_offset + safe_limit < coalesce(total_count, 0),
    'listing_id', p_listing_id,
    'seller_id', listing_seller,
    'seller_username', seller_username,
    'is_seller', caller = listing_seller,
    'can_contact_seller', can_contact_seller
  );
end;
$$;

revoke all on function public.get_marketplace_listing_comments(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_marketplace_listing_comments(uuid, integer, integer)
  to authenticated;

drop function if exists public.add_marketplace_listing_comment(uuid, text, uuid);
create function public.add_marketplace_listing_comment(
  p_listing_id uuid,
  p_body text,
  p_parent_comment_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  parent_author uuid;
  new_id uuid;
  total_count bigint;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if caller_school is null then
    raise exception 'Verified school membership required';
  end if;
  if not private.can_view_marketplace_listing_comments(p_listing_id, caller) then
    raise exception 'Listing is unavailable';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'Comment must contain 1 to 1000 characters';
  end if;
  if (
    select count(*)
    from public.marketplace_listing_comments comment
    where comment.author_id = caller
      and comment.created_at > now() - interval '1 minute'
  ) >= 10 then
    raise exception 'Please wait before adding another comment';
  end if;
  if (
    select count(*)
    from public.marketplace_listing_comments comment
    where comment.author_id = caller
      and comment.created_at > now() - interval '1 hour'
  ) >= 100 then
    raise exception 'Hourly comment limit reached';
  end if;

  if p_parent_comment_id is not null then
    select parent.author_id
    into parent_author
    from public.marketplace_listing_comments parent
    join public.school_memberships parent_membership
      on parent_membership.user_id = parent.author_id
     and parent_membership.status = 'verified'
    where parent.id = p_parent_comment_id
      and parent.listing_id = p_listing_id
      and parent.parent_comment_id is null
      and parent.status = 'published'
      and parent.deleted_at is null;

    if parent_author is null then
      raise exception 'Parent comment is unavailable';
    end if;
    if exists (
      select 1
      from public.user_blocks block
      where (
        block.blocker_id = caller
        and block.blocked_id = parent_author
      ) or (
        block.blocker_id = parent_author
        and block.blocked_id = caller
      )
    ) then
      raise exception 'Parent comment is unavailable';
    end if;
  end if;

  insert into public.marketplace_listing_comments (
    listing_id,
    author_id,
    parent_comment_id,
    body
  ) values (
    p_listing_id,
    caller,
    p_parent_comment_id,
    trim(p_body)
  )
  returning id into new_id;

  select count(*)::bigint
  into total_count
  from public.marketplace_listing_comments comment
  where comment.listing_id = p_listing_id
    and comment.status = 'published'
    and comment.deleted_at is null;

  return jsonb_build_object(
    'comment_id', new_id,
    'listing_id', p_listing_id,
    'parent_comment_id', p_parent_comment_id,
    'comment_count', total_count
  );
end;
$$;

revoke all on function public.add_marketplace_listing_comment(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.add_marketplace_listing_comment(uuid, text, uuid)
  to authenticated;

create or replace function public.toggle_marketplace_listing_comment_like(
  p_comment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  target_listing uuid;
  comment_author uuid;
  is_liked boolean;
  total_likes bigint;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if caller_school is null then
    raise exception 'Verified school membership required';
  end if;

  select comment.listing_id, comment.author_id
  into target_listing, comment_author
  from public.marketplace_listing_comments comment
  join public.school_memberships author_membership
    on author_membership.user_id = comment.author_id
   and author_membership.status = 'verified'
  where comment.id = p_comment_id
    and comment.status = 'published'
    and comment.deleted_at is null;

  if target_listing is null
     or not private.can_view_marketplace_listing_comments(target_listing, caller) then
    raise exception 'Comment is unavailable';
  end if;
  if exists (
    select 1
    from public.user_blocks block
    where (
      block.blocker_id = caller
      and block.blocked_id = comment_author
    ) or (
      block.blocker_id = comment_author
      and block.blocked_id = caller
    )
  ) then
    raise exception 'Comment is unavailable';
  end if;

  delete from public.marketplace_listing_comment_likes comment_like
  where comment_like.comment_id = p_comment_id
    and comment_like.user_id = caller;

  if found then
    is_liked := false;
  else
    insert into public.marketplace_listing_comment_likes (comment_id, user_id)
    values (p_comment_id, caller);
    is_liked := true;
  end if;

  select count(*)::bigint
  into total_likes
  from public.marketplace_listing_comment_likes comment_like
  where comment_like.comment_id = p_comment_id;

  return jsonb_build_object(
    'comment_id', p_comment_id,
    'liked', is_liked,
    'like_count', total_likes
  );
end;
$$;

revoke all on function public.toggle_marketplace_listing_comment_like(uuid)
  from public, anon, authenticated;
grant execute on function public.toggle_marketplace_listing_comment_like(uuid)
  to authenticated;

create or replace function public.delete_marketplace_listing_comment(
  p_comment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_listing uuid;
  total_count bigint;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  update public.marketplace_listing_comments comment
  set
    status = 'removed',
    deleted_at = now()
  where comment.id = p_comment_id
    and comment.author_id = caller
    and comment.deleted_at is null
  returning comment.listing_id into target_listing;

  if target_listing is null then
    raise exception 'Comment is unavailable';
  end if;

  select count(*)::bigint
  into total_count
  from public.marketplace_listing_comments comment
  where comment.listing_id = target_listing
    and comment.status = 'published'
    and comment.deleted_at is null;

  return jsonb_build_object(
    'comment_id', p_comment_id,
    'listing_id', target_listing,
    'deleted', true,
    'comment_count', total_count
  );
end;
$$;

revoke all on function public.delete_marketplace_listing_comment(uuid)
  from public, anon, authenticated;
grant execute on function public.delete_marketplace_listing_comment(uuid)
  to authenticated;

-- Refresh PostgREST's schema cache so the new and replaced RPC signatures are
-- available immediately after this migration finishes.
notify pgrst, 'reload schema';
