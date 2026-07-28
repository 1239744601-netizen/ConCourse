-- ConCourse Realtime messaging activation
--
-- Run after:
--   1. supabase-setup-part-1.sql
--   2. supabase-setup-part-2.sql
--   3. supabase-global-market-fix.sql
--
-- The messaging UI reads through security-definer RPCs, but Supabase
-- Postgres Changes still requires SELECT privileges and row-level SELECT
-- policies before it can authorize a subscriber. These policies expose rows
-- only to the two participants in a readable conversation. The service role
-- continues to bypass RLS for trusted operational work.
--
-- Safe to run more than once.

begin;

do $$
declare
  required_column text;
begin
  if to_regclass('public.direct_conversations') is null
     or to_regclass('public.direct_messages') is null
     or to_regprocedure(
       'private.can_read_direct_conversation(uuid,uuid)'
     ) is null then
    raise exception
      'Run the ConCourse Supabase setup and global-market migration before this Realtime messaging migration';
  end if;

  foreach required_column in array array[
    'id',
    'school_key',
    'user_low',
    'user_high',
    'context_type',
    'marketplace_listing_id'
  ]
  loop
    if not exists (
      select 1
      from information_schema.columns column_record
      where column_record.table_schema = 'public'
        and column_record.table_name = 'direct_conversations'
        and column_record.column_name = required_column
    ) then
      raise exception
        'public.direct_conversations.% is missing; run the latest global-market migration first',
        required_column;
    end if;
  end loop;

  foreach required_column in array array[
    'id',
    'conversation_id',
    'sender_id',
    'body',
    'created_at',
    'deleted_at'
  ]
  loop
    if not exists (
      select 1
      from information_schema.columns column_record
      where column_record.table_schema = 'public'
        and column_record.table_name = 'direct_messages'
        and column_record.column_name = required_column
    ) then
      raise exception
        'public.direct_messages.% is missing; run the latest ConCourse setup first',
        required_column;
    end if;
  end loop;
end;
$$;

alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;

revoke all on table public.direct_conversations from public, anon, authenticated;
revoke all on table public.direct_messages from public, anon, authenticated;
grant select on table public.direct_conversations to authenticated;
grant select on table public.direct_messages to authenticated;

-- Keep the supporting membership and block tables private. This guard binds
-- the existing trusted conversation-read check to auth.uid(), so a browser
-- cannot ask whether an arbitrary user may read a conversation.
create or replace function public.can_realtime_read_direct_conversation(
  p_conversation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and private.can_read_direct_conversation(
      p_conversation_id,
      (select auth.uid())
    );
$$;

revoke all on function public.can_realtime_read_direct_conversation(uuid)
  from public, anon, authenticated;
grant execute on function public.can_realtime_read_direct_conversation(uuid)
  to authenticated;

drop policy if exists "Messaging participants can read conversations"
  on public.direct_conversations;
create policy "Messaging participants can read conversations"
on public.direct_conversations
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (
    (select auth.uid()) = user_low
    or (select auth.uid()) = user_high
  )
  and public.can_realtime_read_direct_conversation(id)
);

drop policy if exists "Messaging participants can read messages"
  on public.direct_messages;
create policy "Messaging participants can read messages"
on public.direct_messages
for select
to authenticated
using (
  deleted_at is null
  and public.can_realtime_read_direct_conversation(conversation_id)
);

do $$
declare
  publication_is_all_tables boolean := false;
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication publication
    where publication.pubname = 'supabase_realtime'
  ) then
    execute 'create publication supabase_realtime';
  end if;

  select publication.puballtables
  into publication_is_all_tables
  from pg_catalog.pg_publication publication
  where publication.pubname = 'supabase_realtime';

  if not coalesce(publication_is_all_tables, false)
     and not exists (
       select 1
       from pg_catalog.pg_publication_tables publication_table
       where publication_table.pubname = 'supabase_realtime'
         and publication_table.schemaname = 'public'
         and publication_table.tablename = 'direct_conversations'
     ) then
    execute
      'alter publication supabase_realtime add table public.direct_conversations';
  end if;

  if not coalesce(publication_is_all_tables, false)
     and not exists (
       select 1
       from pg_catalog.pg_publication_tables publication_table
       where publication_table.pubname = 'supabase_realtime'
         and publication_table.schemaname = 'public'
         and publication_table.tablename = 'direct_messages'
     ) then
    execute
      'alter publication supabase_realtime add table public.direct_messages';
  end if;
end;
$$;

commit;

-- Verification output: every boolean should report true.
select
  relation.table_name,
  relation.row_level_security_enabled,
  relation.authenticated_select_granted,
  relation.anon_select_revoked,
  relation.participant_guard_executable,
  relation.participant_policy_present,
  relation.realtime_publication_member
from (
  select
    target.table_name,
    catalog_class.relrowsecurity as row_level_security_enabled,
    has_table_privilege(
      'authenticated',
      format('public.%I', target.table_name),
      'SELECT'
    ) as authenticated_select_granted,
    not has_table_privilege(
      'anon',
      format('public.%I', target.table_name),
      'SELECT'
    ) as anon_select_revoked,
    has_function_privilege(
      'authenticated',
      'public.can_realtime_read_direct_conversation(uuid)',
      'EXECUTE'
    ) as participant_guard_executable,
    exists (
      select 1
      from pg_catalog.pg_policies policy
      where policy.schemaname = 'public'
        and policy.tablename = target.table_name
        and policy.policyname = target.policy_name
        and policy.cmd = 'SELECT'
        and 'authenticated' = any(policy.roles)
    ) as participant_policy_present,
    (
      publication.puballtables
      or exists (
        select 1
        from pg_catalog.pg_publication_tables publication_table
        where publication_table.pubname = 'supabase_realtime'
          and publication_table.schemaname = 'public'
          and publication_table.tablename = target.table_name
      )
    ) as realtime_publication_member
  from (
    values
      (
        'direct_conversations'::text,
        'Messaging participants can read conversations'::text
      ),
      (
        'direct_messages'::text,
        'Messaging participants can read messages'::text
      )
  ) as target(table_name, policy_name)
  join pg_catalog.pg_class catalog_class
    on catalog_class.oid = format('public.%I', target.table_name)::regclass
  cross join pg_catalog.pg_publication publication
  where publication.pubname = 'supabase_realtime'
) relation
order by relation.table_name;
