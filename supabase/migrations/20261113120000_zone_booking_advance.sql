-- Banquet advance (аванс) for the fireplace and lower halls, in hryvnias.
-- The duties form defaults it to 1000 ₴; it travels in the Telegram message.
alter table public.ops_zone_bookings
  add column if not exists advance numeric(10, 2)
  check (advance is null or (advance >= 0 and advance <= 1000000));

comment on column public.ops_zone_bookings.advance is
  'Banquet advance in UAH (halls only; null for booths).';
