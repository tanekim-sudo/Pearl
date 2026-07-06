-- Auth profiles + display-only plan tiers for Lens.
--
-- Write-access model: the writable surface is policies AND grants. RLS
-- denies by default (no write policies exist on plans/subscriptions), and the
-- grant revocations below make that deny-by-default survive a future careless
-- policy or RLS toggle. Only the secret key (server-side, bypasses RLS) can
-- write plan state. New columns added to these tables later must be
-- grant-scoped explicitly — Postgres does not extend a column-scoped grant to
-- new columns automatically.

-- profiles ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Deliberately minimal: inserts only the id, so no profile logic can ever
-- block a signup ("Database error saving new user"). Never copy
-- raw_user_meta_data into profiles here — it is attacker-controlled signup
-- metadata.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- plans ---------------------------------------------------------------------

create table public.plans (
  id text primary key,
  name text not null,
  description text,
  price_cents integer not null default 0,
  sort_order integer not null default 0
);

alter table public.plans enable row level security;

create policy "Plans are readable by everyone"
  on public.plans
  for select to anon, authenticated
  using (true);

-- subscriptions ---------------------------------------------------------------
-- No row = Free tier. Rows are written only server-side (Stripe webhooks,
-- later); the status CHECK makes unexpected webhook values fail at write time
-- instead of at render time in the client.

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status text not null
    check (status in ('active', 'trialing', 'canceled', 'past_due')),
  created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can view own subscriptions"
  on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- grant hardening -------------------------------------------------------------

revoke insert, update, delete on table public.plans from anon, authenticated;
revoke insert, update, delete on table public.subscriptions from anon, authenticated;
revoke insert, update, delete on table public.profiles from anon, authenticated;
grant update (display_name) on table public.profiles to authenticated;
