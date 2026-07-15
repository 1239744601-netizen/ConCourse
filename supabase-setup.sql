-- Run this entire file once in Supabase Dashboard > SQL Editor.
-- It creates one private JSON state record per authenticated ConCourse user.

create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "Users can read their own ConCourse state" on public.user_state;
create policy "Users can read their own ConCourse state"
on public.user_state
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own ConCourse state" on public.user_state;
create policy "Users can insert their own ConCourse state"
on public.user_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own ConCourse state" on public.user_state;
create policy "Users can update their own ConCourse state"
on public.user_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own ConCourse state" on public.user_state;
create policy "Users can delete their own ConCourse state"
on public.user_state
for delete
to authenticated
using ((select auth.uid()) = user_id);
