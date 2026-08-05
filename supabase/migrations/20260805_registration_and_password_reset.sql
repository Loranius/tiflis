begin;

create extension if not exists pgcrypto;

create table if not exists public.registration_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null check (char_length(display_name) between 2 and 120),
  login text not null check (char_length(login) between 2 and 40),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  assigned_role text,
  legacy_user_id text unique references public.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  decision_note text,
  updated_at timestamptz not null default now()
);

create unique index if not exists registration_requests_pending_login_unique
  on public.registration_requests (lower(login))
  where status = 'pending';
create index if not exists registration_requests_status_requested_idx
  on public.registration_requests (status, requested_at desc);

create table if not exists public.password_reset_requests (
  id bigint generated always as identity primary key,
  legacy_user_id text not null references public.users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts smallint not null default 0 check (attempts between 0 and 10),
  created_at timestamptz not null default now()
);

create index if not exists password_reset_requests_lookup_idx
  on public.password_reset_requests (legacy_user_id, created_at desc)
  where consumed_at is null;

alter table public.registration_requests enable row level security;
alter table public.password_reset_requests enable row level security;

revoke all on table public.registration_requests from anon, authenticated;
revoke all on table public.password_reset_requests from anon, authenticated;
grant all on table public.registration_requests to service_role;
grant all on table public.password_reset_requests to service_role;
grant usage, select on all sequences in schema public to service_role;

commit;
