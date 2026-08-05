begin;

create extension if not exists pgcrypto;

-- Older portal versions used this table for already processed requests and
-- included a legacy credential column. Preserve non-secret history, remove
-- that obsolete column permanently, and free the canonical table name for
-- the new Supabase Auth approval flow.
do $$
begin
  if to_regclass('public.registration_requests') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'registration_requests'
         and column_name = 'password'
     ) then
    if to_regclass('public.registration_requests_legacy_archive') is not null then
      raise exception 'registration_requests_legacy_archive already exists';
    end if;

    alter table public.registration_requests
      rename to registration_requests_legacy_archive;
    alter table public.registration_requests_legacy_archive
      drop column if exists password;
    alter table public.registration_requests_legacy_archive
      enable row level security;
    revoke all on table public.registration_requests_legacy_archive from anon, authenticated;
    grant all on table public.registration_requests_legacy_archive to service_role;

    comment on table public.registration_requests_legacy_archive is
      'Legacy registration history. The former credential column was permanently removed during the Supabase Auth migration.';
  end if;
end
$$;

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

drop trigger if exists registration_requests_set_updated_at on public.registration_requests;
create trigger registration_requests_set_updated_at
before update on public.registration_requests
for each row execute function public.set_updated_at();

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
grant usage, select on sequence public.password_reset_requests_id_seq to service_role;

commit;
