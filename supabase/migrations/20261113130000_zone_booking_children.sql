-- Guests split into adults and children. `guests` now holds the adults;
-- `children` is 0 when there are none.
alter table public.ops_zone_bookings
  add column if not exists children integer not null default 0
  check (children between 0 and 300);

comment on column public.ops_zone_bookings.guests is 'Adults at the booking.';
comment on column public.ops_zone_bookings.children is 'Children at the booking; 0 means none.';
