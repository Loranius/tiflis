-- A hall banquet is paid either with an advance (аванс, amount in `advance`)
-- or by перерахунок: the whole bill is already paid. With fully_paid the
-- advance is not used and stays null.
alter table public.ops_zone_bookings
  add column if not exists fully_paid boolean not null default false;

comment on column public.ops_zone_bookings.fully_paid is
  'Перерахунок: the banquet bill is fully paid (halls only); advance is null then.';
