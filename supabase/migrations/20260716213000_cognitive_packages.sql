create table if not exists public.cognitive_package_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.cognitive_package_team_members (
  team_id uuid not null references public.cognitive_package_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'publisher', 'member')),
  primary key (team_id, user_id)
);

create table if not exists public.cognitive_package_keys (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid null,
  public_jwk jsonb not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz null
);

create table if not exists public.cognitive_packages (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid null,
  namespace text not null,
  name text not null,
  version text not null,
  visibility text not null check (visibility in ('private', 'team', 'unlisted', 'public')),
  content_hash text not null,
  manifest jsonb not null,
  publish_receipt jsonb not null,
  deprecated_at timestamptz null,
  replacement text null,
  created_at timestamptz not null default now(),
  unique (namespace, name, version)
);

create index if not exists cognitive_packages_owner_idx on public.cognitive_packages(owner_id, created_at desc);
create index if not exists cognitive_packages_team_idx on public.cognitive_packages(team_id, created_at desc);
create index if not exists cognitive_packages_discovery_idx on public.cognitive_packages(visibility, created_at desc);

alter table public.cognitive_package_keys enable row level security;
alter table public.cognitive_packages enable row level security;
alter table public.cognitive_package_teams enable row level security;
alter table public.cognitive_package_team_members enable row level security;

drop policy if exists "package teams member read" on public.cognitive_package_teams;
create policy "package teams member read" on public.cognitive_package_teams for select
  using (owner_id = auth.uid() or exists (
    select 1 from public.cognitive_package_team_members membership
    where membership.team_id = cognitive_package_teams.id and membership.user_id = auth.uid()
  ));

drop policy if exists "package teams owner write" on public.cognitive_package_teams;
create policy "package teams owner write" on public.cognitive_package_teams for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "package members scoped read" on public.cognitive_package_team_members;
create policy "package members scoped read" on public.cognitive_package_team_members for select
  using (user_id = auth.uid() or exists (
    select 1 from public.cognitive_package_teams team where team.id = team_id and team.owner_id = auth.uid()
  ));

drop policy if exists "package members owner write" on public.cognitive_package_team_members;
create policy "package members owner write" on public.cognitive_package_team_members for all
  using (exists (select 1 from public.cognitive_package_teams team where team.id = team_id and team.owner_id = auth.uid()))
  with check (exists (select 1 from public.cognitive_package_teams team where team.id = team_id and team.owner_id = auth.uid()));

drop policy if exists "package keys owner read" on public.cognitive_package_keys;
create policy "package keys owner read" on public.cognitive_package_keys for select
  using (auth.uid() = owner_id);

drop policy if exists "package keys owner write" on public.cognitive_package_keys;
create policy "package keys owner write" on public.cognitive_package_keys for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "packages scoped read" on public.cognitive_packages;
create policy "packages scoped read" on public.cognitive_packages for select
  using (
    visibility in ('public', 'unlisted')
    or auth.uid() = owner_id
    or (visibility = 'team' and team_id is not null and exists (
      select 1 from public.cognitive_package_team_members membership
      where membership.team_id = cognitive_packages.team_id
        and membership.user_id = auth.uid()
    ))
  );

drop policy if exists "packages owner insert" on public.cognitive_packages;
create policy "packages owner insert" on public.cognitive_packages for insert
  with check (auth.uid() = owner_id);

drop policy if exists "packages owner update" on public.cognitive_packages;
create policy "packages owner update" on public.cognitive_packages for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
