-- One call that replaces the per-request Auth round-trip in the edge functions.
-- Edge functions verify the access token locally (getClaims) and then call this
-- function with the caller's token. It returns the caller's staff profile only
-- while the token's session still exists (not signed out, not expired, the user
-- not banned), so a token from a closed session is refused at once instead of
-- staying usable until it expires.
create or replace function public.tiflis_session_profile()
returns table (
  user_id uuid,
  legacy_user_id text,
  display_name text,
  role text,
  role2 text,
  active boolean,
  can_notify boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select sp.user_id, sp.legacy_user_id, sp.display_name, sp.role, sp.role2, sp.active, sp.can_notify
  from public.staff_profiles sp
  join auth.sessions s on s.user_id = sp.user_id
  join auth.users u on u.id = sp.user_id
  where sp.user_id = auth.uid()
    and s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
    and (s.not_after is null or s.not_after > now())
    and (u.banned_until is null or u.banned_until <= now())
    and u.deleted_at is null
  limit 1;
$$;

revoke all on function public.tiflis_session_profile() from public, anon;
grant execute on function public.tiflis_session_profile() to authenticated;
