-- ConCourse global university marketplace activation patch
-- Run after the existing marketplace setup. Safe to rerun.
-- Existing listings remain campus-only until their seller explicitly opts in.

do $$
begin
  if to_regclass('public.marketplace_listings') is null
     or to_regclass('public.marketplace_listing_media') is null
     or to_regclass('public.marketplace_favorites') is null
     or to_regclass('public.marketplace_offers') is null
     or to_regclass('public.marketplace_orders') is null
     or to_regclass('public.marketplace_reviews') is null
     or to_regclass('public.marketplace_reports') is null
     or to_regclass('private.marketplace_runtime_settings') is null
     or to_regclass('public.direct_conversations') is null
     or to_regclass('public.direct_messages') is null
     or to_regclass('public.school_memberships') is null
     or to_regclass('public.member_profiles') is null
     or to_regclass('public.user_blocks') is null
     or to_regclass('public.community_posts') is null
     or to_regclass('public.community_post_listing_links') is null then
    raise exception 'Run both existing Supabase setup parts before this global-market patch';
  end if;
end;
$$;

alter table public.marketplace_listings
  add column if not exists global_visible boolean not null default false;

alter table public.direct_conversations
  add column if not exists context_type text not null default 'campus';
alter table public.direct_conversations
  add column if not exists marketplace_listing_id uuid;
alter table public.direct_conversations
  drop constraint if exists direct_conversations_context_check;
alter table public.direct_conversations
  add constraint direct_conversations_context_check check (
    (context_type = 'campus' and marketplace_listing_id is null)
    or (context_type = 'marketplace' and marketplace_listing_id is not null)
  );
alter table public.direct_conversations
  drop constraint if exists direct_conversations_marketplace_listing_fk;
alter table public.direct_conversations
  add constraint direct_conversations_marketplace_listing_fk
  foreign key (marketplace_listing_id)
  references public.marketplace_listings(id) on delete cascade;

-- Campus chats are unique per schoolmate pair. Marketplace introductions are
-- unique per listing and pair, so opening a second listing never rewrites the
-- context (or hides the history) of an earlier conversation.
alter table public.direct_conversations
  drop constraint if exists direct_conversations_school_key_user_low_user_high_key;
create unique index if not exists direct_conversations_campus_pair_unique_idx
  on public.direct_conversations (school_key, user_low, user_high)
  where context_type = 'campus';
create unique index if not exists direct_conversations_marketplace_listing_pair_unique_idx
  on public.direct_conversations (marketplace_listing_id, user_low, user_high)
  where context_type = 'marketplace';

create index if not exists marketplace_listings_global_active_created_idx
  on public.marketplace_listings (created_at desc, id desc)
  where global_visible = true and status = 'active';
create index if not exists direct_conversations_marketplace_listing_idx
  on public.direct_conversations (marketplace_listing_id, created_at desc)
  where context_type = 'marketplace';

-- Global cards expose a pseudonymous account and verified institution only.
-- School-only profile fields and self-reported social/contact fields stay null.
create or replace function private.marketplace_global_listing_json(
  p_listing_id uuid,
  p_viewer_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', listing.id,
    'seller_id', listing.seller_id,
    'seller', jsonb_build_object(
      'user_id', profile.user_id,
      'username', profile.username,
      'display_name', null,
      'avatar_path', null,
      'avatar_revision', null,
      'major_of_study', null,
      'seller_rating', coalesce((
        select round(avg(review.rating)::numeric, 2)
        from public.marketplace_reviews review
        where review.reviewee_id = profile.user_id and review.status = 'published'
      ), 0),
      'seller_review_count', (
        select count(*) from public.marketplace_reviews review
        where review.reviewee_id = profile.user_id and review.status = 'published'
      )
    ),
    'school_key', listing.school_key,
    'school_name', seller_membership.school_name,
    'global_visible', true,
    'is_cross_school', true,
    'can_message_seller', coalesce(member.allow_messages, false),
    'title', listing.title,
    'description', listing.description,
    'category', listing.category,
    'mode', listing.mode,
    'condition', listing.item_condition,
    'course_code', listing.course_code,
    'negotiable', listing.negotiable,
    'price_minor', listing.price_minor,
    'currency', listing.currency,
    'delivery_methods', listing.delivery_methods,
    'location_label', listing.location_label,
    'status', listing.status,
    'rights_attestation', null,
    'academic_rights_basis', listing.academic_rights_basis,
    'version', listing.version,
    'created_at', listing.created_at,
    'updated_at', listing.updated_at,
    'media', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', media.id,
        'storage_path', media.storage_path,
        'media_type', media.media_type,
        'mime_type', media.mime_type,
        'width', media.width,
        'height', media.height,
        'duration_seconds', media.duration_seconds,
        'alt_text', media.alt_text,
        'position', media.position
      ) order by media.position)
      from public.marketplace_listing_media media
      where media.listing_id = listing.id
    ), '[]'::jsonb),
    'favorite_count', (
      select count(*) from public.marketplace_favorites favorite
      where favorite.listing_id = listing.id
    ),
    'favorited_by_me', exists (
      select 1 from public.marketplace_favorites favorite
      where favorite.listing_id = listing.id and favorite.user_id = p_viewer_id
    ),
    'offer_count', 0,
    'linked_post_count', 0
  )
  from public.marketplace_listings listing
  join public.profiles profile on profile.user_id = listing.seller_id
  join public.school_memberships seller_membership
    on seller_membership.user_id = listing.seller_id
   and seller_membership.school_key = listing.school_key
   and seller_membership.status = 'verified'
  left join public.member_profiles member on member.user_id = listing.seller_id
  where listing.id = p_listing_id
    and listing.global_visible = true
    and listing.status = 'active';
$$;

revoke all on function private.marketplace_global_listing_json(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.can_view_marketplace_media(
  p_owner_id text,
  p_object_path text
)
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
      from public.marketplace_listing_media media
      join public.marketplace_listings listing
        on listing.id = media.listing_id
       and listing.seller_id = media.owner_id
      where media.owner_id::text = p_owner_id
        and media.storage_path = p_object_path
        and (
          exists (
            select 1 from public.marketplace_orders orders
            where orders.listing_id = listing.id
              and ((select auth.uid()) = orders.buyer_id or (select auth.uid()) = orders.seller_id)
          )
          or (
            listing.status in ('active', 'reserved')
            and exists (
              select 1 from public.school_memberships viewer
              where viewer.user_id = (select auth.uid())
                and viewer.status = 'verified'
                and (
                  viewer.school_key = listing.school_key
                  or (
                    viewer.school_key <> listing.school_key
                    and listing.global_visible = true
                    and listing.status = 'active'
                  )
                )
            )
            and exists (
              select 1 from public.school_memberships seller_membership
              where seller_membership.user_id = listing.seller_id
                and seller_membership.school_key = listing.school_key
                and seller_membership.status = 'verified'
            )
            and not exists (
              select 1 from public.user_blocks block
              where (block.blocker_id = (select auth.uid()) and block.blocked_id = listing.seller_id)
                 or (block.blocker_id = listing.seller_id and block.blocked_id = (select auth.uid()))
            )
          )
        )
    );
$$;

revoke all on function public.can_view_marketplace_media(text, text)
  from public, anon, authenticated;
grant execute on function public.can_view_marketplace_media(text, text)
  to authenticated;

create or replace function public.get_global_marketplace_feed(
  p_limit integer default 24,
  p_offset integer default 0,
  p_query text default null,
  p_category text default null,
  p_mode text default null,
  p_sort text default 'recent'
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
  safe_limit integer := least(greatest(coalesce(p_limit, 24), 1), 50);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  safe_query text := nullif(left(trim(coalesce(p_query, '')), 120), '');
  safe_category text := nullif(lower(trim(coalesce(p_category, ''))), '');
  safe_mode text := nullif(lower(trim(coalesce(p_mode, ''))), '');
  safe_sort text := lower(trim(coalesce(p_sort, 'recent')));
  item_rows jsonb;
  row_count integer;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if safe_category is not null and safe_category <> 'all' and safe_category not in (
    'notes', 'past_papers', 'textbooks', 'electronics', 'furniture',
    'life_essentials', 'services', 'other'
  ) then raise exception 'Unsupported marketplace category'; end if;
  if safe_mode is not null and safe_mode <> 'all'
     and safe_mode not in ('sale', 'free', 'wanted', 'saved') then
    raise exception 'Unsupported marketplace mode';
  end if;
  if safe_sort not in ('recent', 'price_asc', 'price_desc', 'popular') then
    raise exception 'Unsupported marketplace sort';
  end if;

  with ranked as (
    select listing.id, listing.price_minor, listing.created_at,
      (select count(*) from public.marketplace_favorites favorite where favorite.listing_id = listing.id) as popularity
    from public.marketplace_listings listing
    join public.school_memberships seller_membership
      on seller_membership.user_id = listing.seller_id
     and seller_membership.school_key = listing.school_key
     and seller_membership.status = 'verified'
    where listing.school_key <> caller_school
      and listing.global_visible = true
      and listing.status = 'active'
      and (safe_category is null or safe_category = 'all' or listing.category = safe_category)
      and (
        safe_mode is null
        or safe_mode = 'all'
        or (safe_mode in ('sale', 'free', 'wanted') and listing.mode = safe_mode)
        or (
          safe_mode = 'saved'
          and exists (
            select 1 from public.marketplace_favorites saved
            where saved.listing_id = listing.id and saved.user_id = caller
          )
        )
      )
      and (
        safe_query is null
        or listing.title ilike '%' || safe_query || '%'
        or listing.description ilike '%' || safe_query || '%'
        or coalesce(listing.course_code, '') ilike '%' || safe_query || '%'
        or coalesce(listing.location_label, '') ilike '%' || safe_query || '%'
        or seller_membership.school_name ilike '%' || safe_query || '%'
      )
      and not exists (
        select 1 from public.user_blocks block
        where (block.blocker_id = caller and block.blocked_id = listing.seller_id)
           or (block.blocker_id = listing.seller_id and block.blocked_id = caller)
      )
    order by
      case when safe_sort = 'price_asc' then listing.price_minor end asc nulls last,
      case when safe_sort = 'price_desc' then listing.price_minor end desc nulls last,
      case when safe_sort = 'popular' then
        (select count(*) from public.marketplace_favorites favorite where favorite.listing_id = listing.id)
      end desc nulls last,
      listing.created_at desc,
      listing.id desc
    limit safe_limit + 1 offset safe_offset
  ), visible as (
    select ranked.id, row_number() over (
      order by
        case when safe_sort = 'price_asc' then ranked.price_minor end asc nulls last,
        case when safe_sort = 'price_desc' then ranked.price_minor end desc nulls last,
        case when safe_sort = 'popular' then ranked.popularity end desc nulls last,
        ranked.created_at desc,
        ranked.id desc
    ) as position
    from ranked
    limit safe_limit
  )
  select
    coalesce(jsonb_agg(private.marketplace_global_listing_json(visible.id, caller) order by visible.position), '[]'::jsonb),
    (select count(*)::integer from ranked)
  into item_rows, row_count
  from visible;

  return jsonb_build_object(
    'items', coalesce(item_rows, '[]'::jsonb),
    'limit', safe_limit,
    'offset', safe_offset,
    'has_more', coalesce(row_count, 0) > safe_limit,
    'checkout_enabled', false
  );
end;
$$;

revoke all on function public.get_global_marketplace_feed(integer, integer, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.get_global_marketplace_feed(integer, integer, text, text, text, text)
  to authenticated;

create or replace function public.get_marketplace_listing(p_listing_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  listing_row public.marketplace_listings%rowtype;
  result jsonb;
  offer_rows jsonb;
  is_transaction_participant boolean := false;
  is_cross_school_view boolean := false;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into listing_row from public.marketplace_listings where id = p_listing_id;
  if not found then raise exception 'Listing is unavailable'; end if;
  is_transaction_participant := listing_row.seller_id = caller or exists (
    select 1 from public.marketplace_orders orders
    where orders.listing_id = p_listing_id and orders.buyer_id = caller
  );
  if not is_transaction_participant then
    is_cross_school_view := caller_school is not null
      and listing_row.school_key <> caller_school
      and listing_row.global_visible = true
      and listing_row.status = 'active';
    if caller_school is null or not (
      (listing_row.school_key = caller_school and listing_row.status in ('active', 'reserved'))
      or is_cross_school_view
    ) then raise exception 'Listing is unavailable'; end if;
    if not exists (
      select 1 from public.school_memberships seller_membership
      where seller_membership.user_id = listing_row.seller_id
        and seller_membership.school_key = listing_row.school_key
        and seller_membership.status = 'verified'
    ) then raise exception 'Listing is unavailable'; end if;
    if exists (
      select 1 from public.user_blocks block
      where (block.blocker_id = caller and block.blocked_id = listing_row.seller_id)
         or (block.blocker_id = listing_row.seller_id and block.blocked_id = caller)
    ) then raise exception 'Listing is unavailable'; end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', offer.id,
    'buyer', private.marketplace_member_json(offer.buyer_id),
    'amount_minor', offer.amount_minor,
    'message', offer.message,
    'status', offer.status,
    'created_at', offer.created_at,
    'updated_at', offer.updated_at
  ) order by offer.created_at desc), '[]'::jsonb)
  into offer_rows
  from public.marketplace_offers offer
  where offer.listing_id = p_listing_id
    and (listing_row.seller_id = caller or offer.buyer_id = caller);

  result := case
    when is_cross_school_view then private.marketplace_global_listing_json(p_listing_id, caller)
    else private.marketplace_listing_json(p_listing_id, caller) || jsonb_build_object(
      'global_visible', listing_row.global_visible,
      'is_cross_school', false
    )
  end;
  return result || jsonb_build_object(
    'is_seller', listing_row.seller_id = caller,
    'offers', coalesce(offer_rows, '[]'::jsonb),
    'checkout_enabled', case when is_cross_school_view then false else coalesce((
      select setting.checkout_enabled
      from private.marketplace_runtime_settings setting
      where setting.singleton = true
    ), false) end
  );
end;
$$;

revoke all on function public.get_marketplace_listing(uuid)
  from public, anon, authenticated;
grant execute on function public.get_marketplace_listing(uuid) to authenticated;

create or replace function public.get_my_marketplace_listings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  items jsonb;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select coalesce(jsonb_agg(
    private.marketplace_listing_json(listing.id, caller) || jsonb_build_object(
      'global_visible', listing.global_visible,
      'is_cross_school', false
    )
    order by listing.updated_at desc, listing.id desc
  ), '[]'::jsonb)
  into items
  from public.marketplace_listings listing
  where listing.seller_id = caller;
  return jsonb_build_object('items', items);
end;
$$;

revoke all on function public.get_my_marketplace_listings()
  from public, anon, authenticated;
grant execute on function public.get_my_marketplace_listings() to authenticated;

create or replace function public.set_marketplace_listing_global_visibility(
  p_listing_id uuid,
  p_visible boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  listing_row public.marketplace_listings%rowtype;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if p_listing_id is null or p_visible is null then
    raise exception 'Listing visibility is required';
  end if;
  select * into listing_row
  from public.marketplace_listings listing
  where listing.id = p_listing_id and listing.seller_id = caller
  for update;
  if not found then raise exception 'Listing is unavailable'; end if;
  if p_visible and (caller_school is null or caller_school <> listing_row.school_key) then
    raise exception 'Verified school membership is required to share a listing globally';
  end if;
  update public.marketplace_listings
  set global_visible = p_visible,
      version = version + case when global_visible is distinct from p_visible then 1 else 0 end,
      updated_at = case when global_visible is distinct from p_visible then now() else updated_at end
  where id = p_listing_id;
  return jsonb_build_object(
    'listing_id', p_listing_id,
    'global_visible', p_visible,
    'globally_discoverable', p_visible and listing_row.status = 'active'
  );
end;
$$;

revoke all on function public.set_marketplace_listing_global_visibility(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_marketplace_listing_global_visibility(uuid, boolean)
  to authenticated;

create or replace function public.toggle_marketplace_favorite(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  listing_row public.marketplace_listings%rowtype;
  is_favorite boolean;
  total bigint;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  select * into listing_row from public.marketplace_listings listing
  where listing.id = p_listing_id
    and listing.status in ('active', 'reserved')
    and (
      listing.school_key = caller_school
      or (
        listing.school_key <> caller_school
        and listing.global_visible = true
        and listing.status = 'active'
      )
    );
  if not found then raise exception 'Listing is unavailable'; end if;
  if not exists (
    select 1 from public.school_memberships seller_membership
    where seller_membership.user_id = listing_row.seller_id
      and seller_membership.school_key = listing_row.school_key
      and seller_membership.status = 'verified'
  ) then raise exception 'Listing is unavailable'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = listing_row.seller_id)
       or (block.blocker_id = listing_row.seller_id and block.blocked_id = caller)
  ) then raise exception 'Listing is unavailable'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'concourse:marketplace-favorite:' || caller::text || ':' || p_listing_id::text,
      0
    )
  );
  delete from public.marketplace_favorites
  where listing_id = p_listing_id and user_id = caller;
  if found then
    is_favorite := false;
  else
    insert into public.marketplace_favorites (listing_id, user_id)
    values (p_listing_id, caller);
    is_favorite := true;
  end if;
  select count(*) into total
  from public.marketplace_favorites where listing_id = p_listing_id;
  return jsonb_build_object(
    'listing_id', p_listing_id,
    'favorited', is_favorite,
    'favorite_count', total
  );
end;
$$;

revoke all on function public.toggle_marketplace_favorite(uuid)
  from public, anon, authenticated;
grant execute on function public.toggle_marketplace_favorite(uuid)
  to authenticated;

create or replace function public.report_marketplace_listing(
  p_listing_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  listing_row public.marketplace_listings%rowtype;
  report_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'Report reason must contain 3 to 500 characters';
  end if;
  select * into listing_row from public.marketplace_listings listing
  where listing.id = p_listing_id
    and listing.status <> 'deleted'
    and (
      listing.school_key = caller_school
      or (
        listing.school_key <> caller_school
        and listing.global_visible = true
        and listing.status = 'active'
      )
    );
  if not found or listing_row.seller_id = caller then
    raise exception 'Listing is unavailable for reporting';
  end if;
  if not exists (
    select 1 from public.school_memberships seller_membership
    where seller_membership.user_id = listing_row.seller_id
      and seller_membership.school_key = listing_row.school_key
      and seller_membership.status = 'verified'
  ) then raise exception 'Listing is unavailable for reporting'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = listing_row.seller_id)
       or (block.blocker_id = listing_row.seller_id and block.blocked_id = caller)
  ) then raise exception 'Listing is unavailable for reporting'; end if;
  if exists (
    select 1 from public.marketplace_reports report
    where report.listing_id = p_listing_id and report.reporter_id = caller
      and report.status in ('open', 'reviewing')
  ) then raise exception 'You already reported this listing'; end if;
  if (
    select count(*) from public.marketplace_reports
    where reporter_id = caller and created_at > now() - interval '1 hour'
  ) >= 20 then raise exception 'Please wait before submitting another report'; end if;
  insert into public.marketplace_reports (listing_id, reporter_id, reason)
  values (p_listing_id, caller, trim(p_reason)) returning id into report_id;
  return jsonb_build_object(
    'report_id', report_id,
    'listing_id', p_listing_id,
    'status', 'open'
  );
end;
$$;

revoke all on function public.report_marketplace_listing(uuid, text)
  from public, anon, authenticated;
grant execute on function public.report_marketplace_listing(uuid, text)
  to authenticated;

-- Reinstall the campus starter against the new partial campus uniqueness rule.
-- Its target-school, message-setting, and bilateral-block behavior is unchanged.
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

  insert into public.direct_conversations (
    school_key, user_low, user_high, created_by, context_type, marketplace_listing_id
  ) values (
    caller_school, low_user, high_user, caller, 'campus', null
  )
  on conflict (school_key, user_low, user_high) where context_type = 'campus'
  do update set school_key = excluded.school_key
  returning id into conversation;
  return conversation;
end;
$$;

revoke all on function public.start_direct_conversation(text)
  from public, anon, authenticated;
grant execute on function public.start_direct_conversation(text) to authenticated;

-- Reading is intentionally less restrictive than sending for marketplace
-- introductions. Participants keep their history after a listing closes, an
-- opt-in is withdrawn, a message preference changes, a block is added, or a
-- membership is revoked. Campus conversation visibility remains unchanged.
create or replace function private.can_read_direct_conversation(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.direct_conversations conversation
    where conversation.id = p_conversation_id
      and (conversation.user_low = p_user_id or conversation.user_high = p_user_id)
      and (
        (
          conversation.context_type = 'marketplace'
          and conversation.marketplace_listing_id is not null
        )
        or (
          conversation.context_type = 'campus'
          and conversation.marketplace_listing_id is null
          and exists (
            select 1
            from public.school_memberships viewer_membership
            join public.school_memberships other_membership
              on other_membership.user_id = case
                when conversation.user_low = p_user_id then conversation.user_high
                else conversation.user_low
              end
             and other_membership.status = 'verified'
             and other_membership.school_key = conversation.school_key
            where viewer_membership.user_id = p_user_id
              and viewer_membership.status = 'verified'
              and viewer_membership.school_key = conversation.school_key
          )
          and not exists (
            select 1
            from public.user_blocks block
            where (
              block.blocker_id = p_user_id
              and block.blocked_id = case
                when conversation.user_low = p_user_id then conversation.user_high
                else conversation.user_low
              end
            ) or (
              block.blocked_id = p_user_id
              and block.blocker_id = case
                when conversation.user_low = p_user_id then conversation.user_high
                else conversation.user_low
              end
            )
          )
        )
      )
  );
$$;

revoke all on function private.can_read_direct_conversation(uuid, uuid)
  from public, anon, authenticated;

-- This remains the strict send gate. Marketplace messages require a live,
-- globally shared listing, two verified members, bilateral messaging opt-in,
-- and no block in either direction.
create or replace function private.can_use_direct_conversation(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.direct_conversations conversation
    join public.school_memberships viewer_membership
      on viewer_membership.user_id = p_user_id
     and viewer_membership.status = 'verified'
    join public.school_memberships other_membership
      on other_membership.user_id = case
        when conversation.user_low = p_user_id then conversation.user_high
        else conversation.user_low
      end
     and other_membership.status = 'verified'
    where conversation.id = p_conversation_id
      and (conversation.user_low = p_user_id or conversation.user_high = p_user_id)
      and not exists (
        select 1 from public.user_blocks block
        where (block.blocker_id = p_user_id and block.blocked_id = other_membership.user_id)
           or (block.blocked_id = p_user_id and block.blocker_id = other_membership.user_id)
      )
      and (
        (
          conversation.context_type = 'campus'
          and conversation.marketplace_listing_id is null
          and conversation.school_key = viewer_membership.school_key
          and conversation.school_key = other_membership.school_key
        )
        or (
          conversation.context_type = 'marketplace'
          and exists (
            select 1
            from public.marketplace_listings listing
            join public.school_memberships seller_membership
              on seller_membership.user_id = listing.seller_id
             and seller_membership.school_key = listing.school_key
             and seller_membership.status = 'verified'
            join public.member_profiles viewer_profile
              on viewer_profile.user_id = p_user_id
             and viewer_profile.allow_messages = true
            join public.member_profiles other_profile
              on other_profile.user_id = other_membership.user_id
             and other_profile.allow_messages = true
            where listing.id = conversation.marketplace_listing_id
              and listing.global_visible = true
              and listing.status = 'active'
              and listing.school_key = conversation.school_key
              and listing.seller_id in (conversation.user_low, conversation.user_high)
              and viewer_membership.school_key <> other_membership.school_key
          )
        )
      )
  );
$$;

revoke all on function private.can_use_direct_conversation(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.start_marketplace_conversation(p_listing_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  listing_row public.marketplace_listings%rowtype;
  low_user uuid;
  high_user uuid;
  conversation_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  select * into listing_row
  from public.marketplace_listings listing
  where listing.id = p_listing_id
    and listing.global_visible = true
    and listing.status = 'active';
  if not found or listing_row.seller_id = caller or listing_row.school_key = caller_school then
    raise exception 'This global listing is unavailable for an introduction';
  end if;
  if not exists (
    select 1 from public.school_memberships seller_membership
    where seller_membership.user_id = listing_row.seller_id
      and seller_membership.school_key = listing_row.school_key
      and seller_membership.status = 'verified'
  ) then raise exception 'This global listing is unavailable for an introduction'; end if;
  if not exists (
    select 1 from public.member_profiles member
    where member.user_id = caller and member.allow_messages = true
  ) then raise exception 'Enable Allow messages before contacting a global seller'; end if;
  if not exists (
    select 1 from public.member_profiles member
    where member.user_id = listing_row.seller_id and member.allow_messages = true
  ) then raise exception 'This seller is not accepting messages'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = listing_row.seller_id)
       or (block.blocker_id = listing_row.seller_id and block.blocked_id = caller)
  ) then raise exception 'Messaging is unavailable because one participant blocked the other'; end if;
  if (
    select count(*) from public.direct_conversations existing
    where existing.created_by = caller
      and existing.context_type = 'marketplace'
      and existing.created_at > now() - interval '1 hour'
  ) >= 20 then raise exception 'Please wait before starting another marketplace conversation'; end if;

  if caller::text < listing_row.seller_id::text then
    low_user := caller;
    high_user := listing_row.seller_id;
  else
    low_user := listing_row.seller_id;
    high_user := caller;
  end if;
  insert into public.direct_conversations (
    school_key, user_low, user_high, created_by, context_type, marketplace_listing_id
  ) values (
    listing_row.school_key, low_user, high_user, caller, 'marketplace', p_listing_id
  )
  on conflict (marketplace_listing_id, user_low, user_high)
    where context_type = 'marketplace'
  do update set school_key = excluded.school_key
  returning id into conversation_id;
  return conversation_id;
end;
$$;

revoke all on function public.start_marketplace_conversation(uuid)
  from public, anon, authenticated;
grant execute on function public.start_marketplace_conversation(uuid)
  to authenticated;

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
  last_message_at timestamptz,
  conversation_context text,
  marketplace_listing_id uuid,
  marketplace_listing_title text,
  other_school_name text,
  can_send boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Authentication required'; end if;
  return query
  with mine as (
    select
      conversation.id,
      case when conversation.user_low = caller then conversation.user_high else conversation.user_low end as other_id,
      conversation.context_type,
      conversation.marketplace_listing_id,
      conversation.created_at
    from public.direct_conversations conversation
    where (conversation.user_low = caller or conversation.user_high = caller)
      and private.can_read_direct_conversation(conversation.id, caller)
  )
  select
    mine.id,
    mine.other_id,
    profile.username,
    case when mine.context_type = 'campus' and member.profile_visibility = 'school'
      then member.display_name else null end,
    case when mine.context_type = 'campus' and member.profile_visibility = 'school'
      then member.avatar_path else null end,
    case when mine.context_type = 'campus' and member.profile_visibility = 'school'
      then member.avatar_revision else null end,
    latest.body,
    latest.created_at,
    mine.context_type,
    mine.marketplace_listing_id,
    listing.title,
    case when mine.context_type = 'marketplace' then other_membership.school_name else null end,
    private.can_use_direct_conversation(mine.id, caller)
      and coalesce(member.allow_messages, false)
  from mine
  left join public.profiles profile on profile.user_id = mine.other_id
  left join public.school_memberships other_membership
    on other_membership.user_id = mine.other_id
  left join public.member_profiles member on member.user_id = mine.other_id
  left join public.marketplace_listings listing on listing.id = mine.marketplace_listing_id
  left join lateral (
    select message.body, message.created_at
    from public.direct_messages message
    where message.conversation_id = mine.id and message.deleted_at is null
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  order by coalesce(latest.created_at, mine.created_at) desc, mine.id desc;
end;
$$;

revoke all on function public.get_my_conversations()
  from public, anon, authenticated;
grant execute on function public.get_my_conversations() to authenticated;

create or replace function public.get_conversation_messages(
  p_conversation_id uuid,
  p_limit integer default 100
)
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
begin
  if caller is null or not private.can_read_direct_conversation(p_conversation_id, caller) then
    raise exception 'Conversation is unavailable';
  end if;
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

revoke all on function public.get_conversation_messages(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_conversation_messages(uuid, integer)
  to authenticated;

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
  other_user uuid;
  new_id uuid;
begin
  if caller is null or not private.can_use_direct_conversation(p_conversation_id, caller) then
    raise exception 'Conversation is unavailable';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'Message must contain 1 to 2000 characters';
  end if;
  if p_client_nonce is null then raise exception 'Message identifier is required'; end if;
  if (
    select count(*) from public.direct_messages
    where sender_id = caller and created_at > now() - interval '1 minute'
  ) >= 30 then raise exception 'Please wait before sending another message'; end if;
  select case when conversation.user_low = caller then conversation.user_high else conversation.user_low end
  into other_user
  from public.direct_conversations conversation
  where conversation.id = p_conversation_id
    and (conversation.user_low = caller or conversation.user_high = caller);
  if other_user is null then raise exception 'Conversation is unavailable'; end if;
  if not exists (
    select 1 from public.member_profiles member
    where member.user_id = other_user and member.allow_messages = true
  ) then raise exception 'This student is not accepting messages'; end if;
  insert into public.direct_messages (conversation_id, sender_id, client_nonce, body)
  values (p_conversation_id, caller, p_client_nonce, trim(p_body))
  on conflict (sender_id, client_nonce) do update set body = public.direct_messages.body
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.send_direct_message(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.send_direct_message(uuid, text, uuid)
  to authenticated;

-- Reporting remains available to a conversation participant after a listing
-- closes or either user disables chat, so those safety actions cannot be
-- evaded by changing visibility settings.
create or replace function public.report_conversation_user(
  p_conversation_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  other_user uuid;
  new_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'A report reason is required';
  end if;
  select case when conversation.user_low = caller then conversation.user_high else conversation.user_low end
  into other_user
  from public.direct_conversations conversation
  where conversation.id = p_conversation_id
    and (conversation.user_low = caller or conversation.user_high = caller)
    and (
      (conversation.context_type = 'campus' and conversation.school_key = private.verified_school_key())
      or (conversation.context_type = 'marketplace' and conversation.marketplace_listing_id is not null)
    );
  if other_user is null then raise exception 'Conversation is unavailable'; end if;
  if exists (
    select 1 from public.content_reports
    where reporter_id = caller and target_type = 'user' and target_id = other_user
      and status in ('open', 'reviewing')
  ) then raise exception 'You already reported this user'; end if;
  if (
    select count(*) from public.content_reports
    where reporter_id = caller and created_at > now() - interval '1 hour'
  ) >= 20 then raise exception 'Please wait before submitting another report'; end if;
  insert into public.content_reports (reporter_id, target_type, target_id, reason)
  values (caller, 'user', other_user, trim(p_reason)) returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.report_conversation_user(uuid, text)
  from public, anon, authenticated;
grant execute on function public.report_conversation_user(uuid, text)
  to authenticated;

-- Preserve market cards on globally visible community promotions without
-- exposing the seller's school-only profile fields.
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
  bookmarked_by_me boolean,
  linked_listing jsonb
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
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'storage_path', attachment.storage_path,
        'media_type', attachment.media_type,
        'mime_type', attachment.mime_type,
        'alt_text', attachment.alt_text,
        'position', attachment.position
      ) order by attachment.position)
      from public.community_post_media attachment
      where attachment.post_id = post.id and attachment.owner_id = post.author_id
    ), '[]'::jsonb),
    (
      select jsonb_build_object(
        'poll_id', community_poll.id,
        'question', community_poll.question,
        'total_votes', (
          select count(*) from public.community_poll_votes poll_vote
          where poll_vote.poll_id = community_poll.id
        ),
        'selected_option_id', (
          select poll_vote.option_id from public.community_poll_votes poll_vote
          where poll_vote.poll_id = community_poll.id and poll_vote.user_id = caller
        ),
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'option_id', poll_option.id,
            'label', poll_option.label,
            'vote_count', (
              select count(*) from public.community_poll_votes option_vote
              where option_vote.poll_id = community_poll.id
                and option_vote.option_id = poll_option.id
            )
          ) order by poll_option.position)
          from public.community_poll_options poll_option
          where poll_option.poll_id = community_poll.id
        ), '[]'::jsonb)
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
    exists (
      select 1 from public.post_likes mine
      where mine.post_id = post.id and mine.user_id = caller
    ),
    exists (
      select 1 from public.post_bookmarks saved
      where saved.post_id = post.id and saved.user_id = caller
    ),
    case when listing.id is not null
      then private.marketplace_global_listing_json(listing.id, caller)
      else null
    end
  from public.community_posts post
  join public.profiles profile on profile.user_id = post.author_id
  join public.school_memberships author_membership
    on author_membership.user_id = post.author_id
   and author_membership.school_key = post.school_key
   and author_membership.status = 'verified'
  left join public.community_post_listing_links link
    on link.post_id = post.id
   and link.seller_id = post.author_id
   and link.school_key = post.school_key
  left join public.marketplace_listings listing
    on listing.id = link.listing_id
   and listing.seller_id = post.author_id
   and listing.school_key = post.school_key
   and listing.global_visible = true
   and listing.status = 'active'
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

notify pgrst, 'reload schema';

select jsonb_build_object(
  'global_marketplace_ready', true,
  'new_listing_default_is_campus_only', coalesce((
    select column_default in ('false', 'false::boolean')
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marketplace_listings'
      and column_name = 'global_visible'
  ), false),
  'global_feed_rpc', to_regprocedure(
    'public.get_global_marketplace_feed(integer,integer,text,text,text,text)'
  ) is not null,
  'global_message_rpc', to_regprocedure(
    'public.start_marketplace_conversation(uuid)'
  ) is not null
) as concourse_global_market_status;
