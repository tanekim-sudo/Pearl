create table public.extension_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

create index extension_artifacts_user_expiry_idx
  on public.extension_artifacts (user_id, expires_at desc);

alter table public.extension_artifacts enable row level security;
create policy "Users manage own extension artifacts"
  on public.extension_artifacts for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table public.extension_generator_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  generator_id text not null,
  result jsonb not null,
  provenance jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index extension_generator_items_user_generator_idx
  on public.extension_generator_items (user_id, generator_id, created_at desc);

alter table public.extension_generator_items enable row level security;
create policy "Users manage own extension generator items"
  on public.extension_generator_items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
