-- Plan tiers shown on the plans page. Display-only until billing ships.
insert into public.plans (id, name, description, price_cents, sort_order)
values
  ('free', 'Free', 'Everything in Lens today. Your work stays in your browser.', 0, 0),
  ('pro', 'Pro', 'For heavier use. Coming soon — same Lens, higher limits.', 800, 1)
on conflict (id) do update
  set name = excluded.name,
      description = excluded.description,
      price_cents = excluded.price_cents,
      sort_order = excluded.sort_order;
