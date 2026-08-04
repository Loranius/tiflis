begin;

alter table public.users
  add column if not exists credential_source text not null default 'legacy',
  add column if not exists updated_at timestamptz not null default now();

alter table public.users
  drop constraint if exists users_credential_source_check;

alter table public.users
  add constraint users_credential_source_check
  check (credential_source in ('legacy', 'auth'));

comment on column public.users.password is
  'Legacy migration credential only. For credential_source=auth this contains an unusable marker, never a working password.';
comment on column public.users.credential_source is
  'legacy until first successful migration; auth after Supabase Auth becomes the source of truth.';

create index if not exists users_active_role_idx
  on public.users (fired, role, role2);

create index if not exists staff_profiles_legacy_active_idx
  on public.staff_profiles (legacy_user_id, active);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

commit;
