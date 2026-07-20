-- ConCourse media upload compatibility patch
-- Run once in Supabase SQL Editor after both setup parts have been installed.
-- Safe to rerun. It enables WebP, JPEG, and PNG for every image-upload feature.

begin;

do $$
begin
  if to_regclass('public.member_profiles') is null
     or to_regclass('public.community_post_media') is null
     or to_regclass('public.marketplace_listing_media') is null
     or to_regprocedure('public.can_upload_member_avatar(text,text)') is null
     or to_regprocedure('public.can_view_member_avatar(text,text)') is null
     or to_regprocedure('public.can_delete_member_avatar(text,text)') is null
     or to_regprocedure('public.can_upload_community_media(text,text)') is null
     or to_regprocedure('public.can_view_community_media(text,text)') is null
     or to_regprocedure('public.can_delete_community_media(text,text)') is null
     or to_regprocedure('public.can_upload_marketplace_media(text,text)') is null
     or to_regprocedure('public.can_view_marketplace_media(text,text)') is null
     or to_regprocedure('public.can_delete_marketplace_media(text,text)') is null
     or to_regprocedure('public.publish_community_post_v2(text,text[],jsonb,text,text[])') is null
     or to_regprocedure('public.create_marketplace_listing(uuid,jsonb,jsonb)') is null then
    raise exception 'Run supabase-setup-part-1.sql and supabase-setup-part-2.sql before this media patch';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profile photos
-- ---------------------------------------------------------------------------

alter table public.member_profiles drop constraint if exists member_profiles_avatar_path_owned;
alter table public.member_profiles add constraint member_profiles_avatar_path_owned
  check (
    avatar_path is null
    or avatar_path = user_id::text || '/avatar.webp'
    or avatar_path ~ ('^' || user_id::text || '/avatar-[0-9a-f-]{36}\.(webp|jpg|png)$')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-avatars', 'member-avatars', false, 2097152, array['image/webp', 'image/jpeg', 'image/png']::text[])
on conflict (id) do update set
  name = excluded.name, public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar owners can upload" on storage.objects;
create policy "Avatar owners can upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'member-avatars'
  and (
    name = (select auth.uid())::text || '/avatar.webp'
    or name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9a-f-]{36}\.(webp|jpg|png)$')
  )
  and public.can_upload_member_avatar((storage.foldername(name))[1], name)
);

drop policy if exists "Avatar owners can read" on storage.objects;
create policy "Avatar owners can read"
on storage.objects for select to authenticated
using (
  bucket_id = 'member-avatars'
  and owner_id = (select auth.uid())::text
  and (
    name = (select auth.uid())::text || '/avatar.webp'
    or name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9a-f-]{36}\.(webp|jpg|png)$')
  )
);

drop policy if exists "Avatar owners can replace" on storage.objects;
create policy "Avatar owners can replace"
on storage.objects for update to authenticated
using (
  bucket_id = 'member-avatars'
  and owner_id = (select auth.uid())::text
  and (
    name = (select auth.uid())::text || '/avatar.webp'
    or name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9a-f-]{36}\.(webp|jpg|png)$')
  )
)
with check (
  bucket_id = 'member-avatars'
  and owner_id = (select auth.uid())::text
  and (
    name = (select auth.uid())::text || '/avatar.webp'
    or name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9a-f-]{36}\.(webp|jpg|png)$')
  )
);

drop policy if exists "Avatar owners can delete" on storage.objects;
create policy "Avatar owners can delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'member-avatars'
  and owner_id = (select auth.uid())::text
  and (
    name = (select auth.uid())::text || '/avatar.webp'
    or name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9a-f-]{36}\.(webp|jpg|png)$')
  )
  and public.can_delete_member_avatar(owner_id, name)
);

drop policy if exists "Verified schoolmates can read visible avatars" on storage.objects;
create policy "Verified schoolmates can read visible avatars"
on storage.objects for select to authenticated
using (
  bucket_id = 'member-avatars'
  and owner_id is not null
  and (
    name = owner_id || '/avatar.webp'
    or name ~ ('^' || owner_id || '/avatar-[0-9a-f-]{36}\.(webp|jpg|png)$')
  )
  and storage.allow_any_operation(array[
    'object.get_authenticated_info',
    'object.get_authenticated'
  ])
  and public.can_view_member_avatar(owner_id, name)
);

-- ---------------------------------------------------------------------------
-- Community images
-- ---------------------------------------------------------------------------

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select constraint_record.conname
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = 'public.community_post_media'::regclass
      and constraint_record.contype = 'c'
      and (
        pg_catalog.pg_get_constraintdef(constraint_record.oid) ilike '%storage_path%'
        or (
          pg_catalog.pg_get_constraintdef(constraint_record.oid) ilike '%mime_type%'
          and pg_catalog.pg_get_constraintdef(constraint_record.oid) ilike '%media_type%'
        )
      )
  loop
    execute format('alter table public.community_post_media drop constraint %I', constraint_row.conname);
  end loop;
end;
$$;

alter table public.community_post_media
  add constraint community_post_media_mime_supported check (
    (media_type = 'image' and mime_type in ('image/webp', 'image/jpeg', 'image/png'))
    or (media_type = 'video' and mime_type in ('video/mp4', 'video/webm', 'video/quicktime'))
  );
alter table public.community_post_media
  add constraint community_post_media_storage_path_matches check (
    storage_path = owner_id::text || '/posts/' || draft_id::text || '/' || id::text ||
      case mime_type
        when 'image/webp' then '.webp'
        when 'image/jpeg' then '.jpg'
        when 'image/png' then '.png'
        when 'video/mp4' then '.mp4'
        when 'video/webm' then '.webm'
        when 'video/quicktime' then '.mov'
      end
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-media', 'community-media', false, 41943040, array['image/webp', 'image/jpeg', 'image/png', 'video/mp4', 'video/webm', 'video/quicktime']::text[])
on conflict (id) do update set
  name = excluded.name, public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Community media owners can upload" on storage.objects;
create policy "Community media owners can upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'community-media'
  and public.can_upload_community_media((storage.foldername(name))[1], name)
  and name ~ (
    '^' || (select auth.uid())::text ||
    '/posts/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png|mp4|webm|mov)$'
  )
);

drop policy if exists "Community media owners can read" on storage.objects;
create policy "Community media owners can read"
on storage.objects for select to authenticated
using (
  bucket_id = 'community-media'
  and owner_id = (select auth.uid())::text
  and name ~ (
    '^' || (select auth.uid())::text ||
    '/posts/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png|mp4|webm|mov)$'
  )
);

drop policy if exists "Community media owners can delete" on storage.objects;
create policy "Community media owners can delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'community-media'
  and owner_id = (select auth.uid())::text
  and name ~ (
    '^' || (select auth.uid())::text ||
    '/posts/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png|mp4|webm|mov)$'
  )
  and public.can_delete_community_media(owner_id, name)
);

drop policy if exists "Verified schoolmates can read community media" on storage.objects;
create policy "Verified schoolmates can read community media"
on storage.objects for select to authenticated
using (
  bucket_id = 'community-media'
  and owner_id is not null
  and name ~ (
    '^' || owner_id ||
    '/posts/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png|mp4|webm|mov)$'
  )
  and storage.allow_any_operation(array[
    'object.get_authenticated_info',
    'object.get_authenticated',
    'storage.object.sign'
  ])
  and public.can_view_community_media(owner_id, name)
);

-- ---------------------------------------------------------------------------
-- Marketplace images
-- ---------------------------------------------------------------------------

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select constraint_record.conname
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = 'public.marketplace_listing_media'::regclass
      and constraint_record.contype = 'c'
      and (
        pg_catalog.pg_get_constraintdef(constraint_record.oid) ilike '%storage_path%'
        or (
          pg_catalog.pg_get_constraintdef(constraint_record.oid) ilike '%mime_type%'
          and pg_catalog.pg_get_constraintdef(constraint_record.oid) ilike '%media_type%'
        )
      )
  loop
    execute format('alter table public.marketplace_listing_media drop constraint %I', constraint_row.conname);
  end loop;
end;
$$;

alter table public.marketplace_listing_media
  add constraint marketplace_listing_media_mime_supported check (
    (media_type = 'image' and mime_type in ('image/webp', 'image/jpeg', 'image/png'))
    or (media_type = 'video' and mime_type in ('video/mp4', 'video/webm', 'video/quicktime'))
  );
alter table public.marketplace_listing_media
  add constraint marketplace_listing_media_storage_path_matches check (
    storage_path = owner_id::text || '/listings/' || listing_id::text || '/' || id::text ||
      case mime_type
        when 'image/webp' then '.webp'
        when 'image/jpeg' then '.jpg'
        when 'image/png' then '.png'
        when 'video/mp4' then '.mp4'
        when 'video/webm' then '.webm'
        when 'video/quicktime' then '.mov'
      end
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace-media', 'marketplace-media', false, 52428800, array['image/webp', 'image/jpeg', 'image/png', 'video/mp4', 'video/webm', 'video/quicktime']::text[])
on conflict (id) do update set
  name = excluded.name, public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Marketplace media owners can upload" on storage.objects;
create policy "Marketplace media owners can upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'marketplace-media'
  and public.can_upload_marketplace_media((storage.foldername(name))[1], name)
  and name ~ (
    '^' || (select auth.uid())::text ||
    '/listings/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png|mp4|webm|mov)$'
  )
);

drop policy if exists "Marketplace media owners can read" on storage.objects;
create policy "Marketplace media owners can read"
on storage.objects for select to authenticated
using (
  bucket_id = 'marketplace-media'
  and owner_id = (select auth.uid())::text
  and name ~ (
    '^' || (select auth.uid())::text ||
    '/listings/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png|mp4|webm|mov)$'
  )
);

drop policy if exists "Marketplace media owners can delete" on storage.objects;
create policy "Marketplace media owners can delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'marketplace-media'
  and owner_id = (select auth.uid())::text
  and name ~ (
    '^' || (select auth.uid())::text ||
    '/listings/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png|mp4|webm|mov)$'
  )
  and public.can_delete_marketplace_media(owner_id, name)
);

drop policy if exists "Verified schoolmates can read marketplace media" on storage.objects;
create policy "Verified schoolmates can read marketplace media"
on storage.objects for select to authenticated
using (
  bucket_id = 'marketplace-media'
  and owner_id is not null
  and name ~ (
    '^' || owner_id ||
    '/listings/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png|mp4|webm|mov)$'
  )
  and storage.allow_any_operation(array[
    'object.get_authenticated_info',
    'object.get_authenticated',
    'storage.object.sign'
  ])
  and public.can_view_marketplace_media(owner_id, name)
);

-- Patch the two existing security-definer publishers without duplicating their
-- large, security-sensitive bodies in this small migration.
do $migration$
declare
  definition text;
begin
  definition := pg_catalog.pg_get_functiondef(
    'public.publish_community_post_v2(text,text[],jsonb,text,text[])'::regprocedure
  );
  if definition not like '%image/jpeg%'
     or definition not like '%image/png%'
     or definition not like '%webp|jpg|png|mp4|webm|mov%' then
    definition := replace(
      definition,
      '\.(webp|mp4|webm|mov)$',
      '\.(webp|jpg|png|mp4|webm|mov)$'
    );
    definition := replace(
      definition,
      $old$expected_suffix := '.webp';
    elsif media_kind = 'video'$old$,
      $new$expected_suffix := '.webp';
    elsif media_kind = 'image' and media_mime = 'image/jpeg' then
      expected_suffix := '.jpg';
    elsif media_kind = 'image' and media_mime = 'image/png' then
      expected_suffix := '.png';
    elsif media_kind = 'video'$new$
    );
    if definition not like '%image/jpeg%'
       or definition not like '%image/png%'
       or definition not like '%webp|jpg|png|mp4|webm|mov%' then
      raise exception 'Could not update publish_community_post_v2; rerun the latest setup Part 1';
    end if;
    execute definition;
  end if;

  definition := pg_catalog.pg_get_functiondef(
    'public.create_marketplace_listing(uuid,jsonb,jsonb)'::regprocedure
  );
  if definition not like '%image/jpeg%' or definition not like '%image/png%' then
    definition := replace(
      definition,
      $old$if media_kind = 'image' and media_mime = 'image/webp' then expected_suffix := '.webp';
    elsif media_kind = 'video'$old$,
      $new$if media_kind = 'image' and media_mime = 'image/webp' then expected_suffix := '.webp';
    elsif media_kind = 'image' and media_mime = 'image/jpeg' then expected_suffix := '.jpg';
    elsif media_kind = 'image' and media_mime = 'image/png' then expected_suffix := '.png';
    elsif media_kind = 'video'$new$
    );
    if definition not like '%image/jpeg%' or definition not like '%image/png%' then
      raise exception 'Could not update create_marketplace_listing; rerun the latest setup Part 2';
    end if;
    execute definition;
  end if;
end;
$migration$;

commit;

select 'ConCourse image uploads are ready' as media_upload_patch_status;
