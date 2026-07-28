-- ConCourse secure Owner Console backend
-- Run after:
--   1. supabase-setup-part-1.sql
--   2. supabase-setup-part-2.sql
--   3. supabase-global-market-fix.sql
--   4. supabase-social-comments.sql
--   5. supabase-account-trust-and-data-fix.sql
--
-- This migration is safe to run more than once. It does not expose
-- public.concourse_admins to browser clients and it intentionally preserves the
-- existing school-verification queue and decision RPC signatures.

do $$
begin
  if to_regclass('public.concourse_admins') is null
     or to_regclass('public.school_verification_requests') is null
     or to_regclass('public.account_deletion_requests') is null then
    raise exception
      'Run supabase-account-trust-and-data-fix.sql before this migration';
  end if;

  if to_regclass('public.content_reports') is null
     or to_regclass('public.marketplace_reports') is null
     or to_regclass('public.marketplace_disputes') is null
     or to_regclass('public.marketplace_listings') is null
     or to_regclass('public.community_posts') is null
     or to_regclass('public.direct_conversations') is null
     or to_regclass('public.direct_messages') is null then
    raise exception
      'Run both Supabase setup parts and the marketplace migrations before this migration';
  end if;

  if to_regprocedure(
       'public.get_school_verification_review_queue(text,integer)'
     ) is null
     or to_regprocedure(
       'public.review_school_verification_request(uuid,text,text,text)'
     ) is null then
    raise exception
      'Install the existing school-verification review RPCs before this migration';
  end if;
end;
$$;

-- Return only the signed-in caller's application role. The administrator
-- registry remains inaccessible through ordinary table APIs.
create or replace function public.get_my_concourse_admin_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  admin_role text;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  select admin_user.role
  into admin_role
  from public.concourse_admins admin_user
  where admin_user.user_id = caller;

  return jsonb_build_object(
    'is_admin', admin_role is not null,
    'role', admin_role,
    'capabilities', jsonb_build_object(
      'view_school_verification_queue',
        coalesce(admin_role in ('owner', 'reviewer'), false),
      'review_school_verification_requests',
        coalesce(admin_role in ('owner', 'reviewer'), false),
      'view_owner_summary',
        coalesce(admin_role = 'owner', false)
    )
  );
end;
$$;

revoke all on function public.get_my_concourse_admin_context()
  from public, anon, authenticated;
grant execute on function public.get_my_concourse_admin_context()
  to authenticated;

-- Aggregate operational health for an owner. This function intentionally
-- exposes counts only: no email, legal name, evidence, message, report body,
-- transaction amount, or other user-level record leaves the function.
create or replace function public.get_concourse_owner_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  account_counts jsonb;
  verification_counts jsonb;
  deletion_counts jsonb;
  community_counts jsonb;
  marketplace_counts jsonb;
  messaging_counts jsonb;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if not private.is_concourse_admin(
    caller,
    array['owner']::text[]
  ) then
    raise exception 'Owner access required';
  end if;

  select jsonb_build_object(
    'total', count(*)::bigint,
    'email_confirmed',
      count(*) filter (where app_user.email_confirmed_at is not null),
    'created_last_30_days',
      count(*) filter (
        where app_user.created_at >= now() - interval '30 days'
      )
  )
  into account_counts
  from auth.users app_user;

  select jsonb_build_object(
    'total', count(*)::bigint,
    'submitted',
      count(*) filter (where request.status = 'submitted'),
    'under_review',
      count(*) filter (where request.status = 'under_review'),
    'approved_last_30_days',
      count(*) filter (
        where request.status = 'approved'
          and request.reviewed_at >= now() - interval '30 days'
      ),
    'rejected_last_30_days',
      count(*) filter (
        where request.status = 'rejected'
          and request.reviewed_at >= now() - interval '30 days'
      )
  )
  into verification_counts
  from public.school_verification_requests request;

  select jsonb_build_object(
    'total', count(*)::bigint,
    'submitted',
      count(*) filter (where request.status = 'submitted'),
    'processing',
      count(*) filter (where request.status = 'processing'),
    'due',
      count(*) filter (
        where request.status in ('submitted', 'processing')
          and request.scheduled_for <= now()
      ),
    'completed_last_30_days',
      count(*) filter (
        where request.status = 'completed'
          and request.completed_at >= now() - interval '30 days'
      )
  )
  into deletion_counts
  from public.account_deletion_requests request;

  select jsonb_build_object(
    'total',
      (
        select count(*)::bigint
        from public.community_posts post
        where post.status = 'published'
          and post.deleted_at is null
      ),
    'published_posts',
      (
        select count(*)::bigint
        from public.community_posts post
        where post.status = 'published'
          and post.deleted_at is null
      ),
    'open_reports',
      (
        select count(*)::bigint
        from public.content_reports report
        where report.status = 'open'
      ),
    'reports_under_review',
      (
        select count(*)::bigint
        from public.content_reports report
        where report.status = 'reviewing'
      )
  )
  into community_counts;

  select jsonb_build_object(
    'total',
      (
        select count(*)::bigint
        from public.marketplace_listings listing
        where listing.status = 'active'
          and listing.deleted_at is null
      ),
    'active_listings',
      (
        select count(*)::bigint
        from public.marketplace_listings listing
        where listing.status = 'active'
          and listing.deleted_at is null
      ),
    'open_reports',
      (
        select count(*)::bigint
        from public.marketplace_reports report
        where report.status = 'open'
      ),
    'reports_under_review',
      (
        select count(*)::bigint
        from public.marketplace_reports report
        where report.status = 'reviewing'
      ),
    'open_disputes',
      (
        select count(*)::bigint
        from public.marketplace_disputes dispute
        where dispute.status = 'open'
      ),
    'disputes_under_review',
      (
        select count(*)::bigint
        from public.marketplace_disputes dispute
        where dispute.status = 'under_review'
      )
  )
  into marketplace_counts;

  select jsonb_build_object(
    'total',
      (
        select count(*)::bigint
        from public.direct_messages message
        where message.deleted_at is null
      ),
    'conversations',
      (select count(*)::bigint from public.direct_conversations),
    'messages',
      (
        select count(*)::bigint
        from public.direct_messages message
        where message.deleted_at is null
      )
  )
  into messaging_counts;

  return jsonb_build_object(
    'generated_at', now(),
    'accounts', account_counts,
    'school_verification', verification_counts,
    'account_deletion', deletion_counts,
    'community', community_counts,
    'marketplace', marketplace_counts,
    'messaging', messaging_counts
  );
end;
$$;

revoke all on function public.get_concourse_owner_summary()
  from public, anon, authenticated;
grant execute on function public.get_concourse_owner_summary()
  to authenticated;

-- Reassert the registry boundary in case an earlier manual experiment granted
-- table access. The two existing review RPCs remain the only supported way for
-- owner/reviewer browser sessions to inspect or decide verification requests.
alter table public.concourse_admins enable row level security;
revoke all on table public.concourse_admins
  from public, anon, authenticated;

notify pgrst, 'reload schema';
