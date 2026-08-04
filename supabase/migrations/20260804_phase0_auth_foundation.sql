begin;

create table if not exists public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  legacy_user_id text unique references public.users(id) on delete set null,
  display_name text,
  role text not null default 'staff',
  role2 text,
  active boolean not null default true,
  can_notify boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.staff_profiles is
  'Bridge between Supabase Auth users and legacy Tiflis staff records.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists staff_profiles_set_updated_at on public.staff_profiles;
create trigger staff_profiles_set_updated_at
before update on public.staff_profiles
for each row execute function public.set_updated_at();

create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.staff_profiles
  where user_id = (select auth.uid())
    and active = true
  limit 1;
$$;

create or replace function public.is_tiflis_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_staff_role() in ('admin', 'sysadmin'), false);
$$;

revoke all on function public.current_staff_role() from public;
revoke all on function public.is_tiflis_admin() from public;
revoke execute on function public.current_staff_role() from anon;
revoke execute on function public.is_tiflis_admin() from anon;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.is_tiflis_admin() to authenticated;

alter table public.staff_profiles enable row level security;

revoke all on table public.staff_profiles from anon;
revoke all on table public.staff_profiles from authenticated;
grant select on table public.staff_profiles to authenticated;
grant insert, update, delete on table public.staff_profiles to service_role;

drop policy if exists "staff read permitted profiles" on public.staff_profiles;
create policy "staff read permitted profiles"
on public.staff_profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_tiflis_admin()
);

commit;
