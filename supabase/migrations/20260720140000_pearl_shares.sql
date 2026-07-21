create table if not exists public.pearl_shares (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete set null,
  team_id text,
  mode text not null check (mode in ('private-once','unlisted','public','team','reference','clone')),
  package jsonb not null,
  permissions jsonb not null default '["inspect","install","fork"]'::jsonb,
  one_time boolean not null default false,
  uses integer not null default 0 check (uses >= 0),
  max_uses integer not null check (max_uses > 0),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);

create index if not exists pearl_shares_expiry_idx on public.pearl_shares (expires_at);
create index if not exists pearl_shares_owner_idx on public.pearl_shares (owner_id, created_at desc);

alter table public.pearl_shares enable row level security;

drop policy if exists "pearl share owners can inspect grants" on public.pearl_shares;
create policy "pearl share owners can inspect grants"
  on public.pearl_shares for select
  to authenticated
  using (owner_id = auth.uid());

revoke all on public.pearl_shares from anon, authenticated;
grant select on public.pearl_shares to authenticated;

comment on table public.pearl_shares is
  'Server-consumed opaque Pearl share grants. Package payload is never encoded into a recipient URL.';

create or replace function public.consume_pearl_share(
  p_id text,
  p_user_id uuid default null,
  p_team_ids text[] default '{}'::text[]
)
returns public.pearl_shares
language plpgsql
security definer
set search_path = public
as $$
declare
  consumed public.pearl_shares;
begin
  update public.pearl_shares
    set uses = uses + 1
    where id = p_id
      and revoked_at is null
      and expires_at > now()
      and uses < max_uses
      and (recipient_id is null or recipient_id = p_user_id)
      and (team_id is null or team_id = any(p_team_ids))
    returning * into consumed;
  if consumed.id is null then
    raise exception 'Pearl share is unavailable, unauthorized, expired, revoked, or consumed.'
      using errcode = 'P0001';
  end if;
  return consumed;
end;
$$;

revoke all on function public.consume_pearl_share(text, uuid, text[]) from public, anon, authenticated;
