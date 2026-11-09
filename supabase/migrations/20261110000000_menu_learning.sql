-- Menu as a learning tool for waiters: teaching fields on each item and per-person progress.

alter table public.menu_items
  add column if not exists explain text,
  add column if not exists sell_line text,
  add column if not exists pairing text,
  add column if not exists learning_reviewed boolean not null default false;

comment on column public.menu_items.explain is 'What the dish is / how to pronounce its name (for staff training).';
comment on column public.menu_items.sell_line is 'One or two sentences a waiter can say to a guest.';
comment on column public.menu_items.pairing is 'What to recommend with it: wine, drink or side.';
comment on column public.menu_items.learning_reviewed is 'False while the teaching fields and allergens are an unreviewed draft.';

create table if not exists public.menu_learning (
  legacy_user_id text not null,
  item_id integer not null references public.menu_items(id) on delete cascade,
  status text not null check (status in ('learning', 'known')),
  updated_at timestamptz not null default now(),
  primary key (legacy_user_id, item_id)
);

-- Only the menu edge function (service role) reads and writes progress.
alter table public.menu_learning enable row level security;
revoke all on public.menu_learning from anon, authenticated;
