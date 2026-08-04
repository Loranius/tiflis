begin;

create table if not exists public.auth_migration_attempts (
  key_hash text primary key,
  attempts integer not null default 0 check (attempts >= 0),
  window_started timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.auth_migration_attempts is
  'Server-only rate limits for the one-time legacy to Supabase Auth login bridge.';

create index if not exists auth_migration_attempts_locked_until_idx
  on public.auth_migration_attempts (locked_until)
  where locked_until is not null;

alter table public.auth_migration_attempts enable row level security;
revoke all on table public.auth_migration_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.auth_migration_attempts to service_role;

commit;
