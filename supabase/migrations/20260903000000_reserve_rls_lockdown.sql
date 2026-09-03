begin;

-- 20260805_reserve_normalization.sql created reserve_halls, reserve_tables and
-- reservations without enabling row level security or revoking the default
-- anon/authenticated grants that Supabase applies to new public tables. That left
-- guest names, phone numbers and reservation data readable and writable by anyone
-- holding the public anon key directly through PostgREST, bypassing the role
-- checks in tiflis-reserve-api entirely. Lock these tables down the same way every
-- sibling migration already does.

alter table public.reserve_halls enable row level security;
alter table public.reserve_tables enable row level security;
alter table public.reservations enable row level security;

revoke all on table public.reserve_halls from anon, authenticated;
revoke all on table public.reserve_tables from anon, authenticated;
revoke all on table public.reservations from anon, authenticated;

grant all on table public.reserve_halls to service_role;
grant all on table public.reserve_tables to service_role;
grant all on table public.reservations to service_role;

grant usage, select on sequence public.reserve_halls_id_seq to service_role;
grant usage, select on sequence public.reserve_tables_id_seq to service_role;
grant usage, select on sequence public.reservations_id_seq to service_role;

commit;
