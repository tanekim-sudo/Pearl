-- Cloud board snapshots: one row per user, JSON blob of lens.* localStorage keys.
-- Signed-in clients sync board state for cross-device continuity.

create table public.board_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.board_snapshots enable row level security;

create policy "Users can view own board snapshot"
  on public.board_snapshots
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own board snapshot"
  on public.board_snapshots
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own board snapshot"
  on public.board_snapshots
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index board_snapshots_updated_at_idx on public.board_snapshots (updated_at desc);
