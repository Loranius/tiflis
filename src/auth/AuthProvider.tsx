import type { User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { edgeFunctionUrl, supabase, supabasePublishableKey } from '../lib/supabase';
import type { LegacyAuthResponse, StaffRole, StaffUser } from '../types';

interface AuthContextValue {
  user: StaffUser | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

interface CachedProfile {
  authUserId: string;
  cachedAt: number;
  profile: StaffUser;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const PROFILE_CACHE_KEY = 'tiflis-v2.staff-profile';
const PROFILE_CACHE_TTL = 15 * 60 * 1000;
const profileRequests = new Map<string, Promise<StaffUser>>();

function normalizeRole(role: string | null | undefined): StaffRole {
  const aliases: Record<string, StaffRole> = {
    barman: 'bar',
    bartender: 'bar',
  };
  const normalized = aliases[role || ''] || role;
  const known: StaffRole[] = [
    'sysadmin',
    'admin',
    'chef',
    'cook',
    'waiter',
    'bar',
    'hostess',
    'runner',
    'staff',
  ];
  return known.includes(normalized as StaffRole) ? (normalized as StaffRole) : 'staff';
}

function mapLegacyUser(data: NonNullable<LegacyAuthResponse['user']>): StaffUser {
  return {
    id: data.id,
    login: data.login,
    displayName: data.display_name || data.login,
    role: normalizeRole(data.id === 'sysadmin' ? 'sysadmin' : data.role),
    role2: data.role2 ? normalizeRole(data.role2) : null,
    active: data.fired !== true,
    canNotify: data.can_notify === true,
    avatar: data.avatar || null,
  };
}

function readCachedProfile(authUserId: string): StaffUser | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedProfile;
    if (
      cached.authUserId !== authUserId
      || Date.now() - cached.cachedAt > PROFILE_CACHE_TTL
      || !cached.profile?.id
      || !cached.profile.active
    ) {
      sessionStorage.removeItem(PROFILE_CACHE_KEY);
      return null;
    }
    return cached.profile;
  } catch {
    // Some privacy modes/WebViews reject every sessionStorage operation, including
    // removeItem. Never retry an unsafe storage call from inside the recovery path.
    return null;
  }
}

function writeCachedProfile(authUserId: string, profile: StaffUser) {
  try {
    const cached: CachedProfile = { authUserId, cachedAt: Date.now(), profile };
    sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Storage can be unavailable in strict privacy modes; auth remains functional without it.
  }
}

function clearCachedProfile() {
  try {
    sessionStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // Ignore storage failures during sign-out.
  }
}

async function fetchStaffProfile(authUser: User): Promise<StaffUser> {
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('legacy_user_id,display_name,role,role2,active,can_notify')
    .eq('user_id', authUser.id)
    .single();

  if (error || !data?.legacy_user_id) {
    throw new Error('Профіль працівника не знайдено');
  }

  return {
    id: String(data.legacy_user_id),
    login: String(data.display_name || 'Працівник'),
    displayName: String(data.display_name || 'Працівник'),
    role: normalizeRole(String(data.role || 'staff')),
    role2: data.role2 ? normalizeRole(String(data.role2)) : null,
    active: data.active === true,
    canNotify: data.can_notify === true,
    avatar: null,
  };
}

function loadStaffProfile(authUser: User): Promise<StaffUser> {
  const existing = profileRequests.get(authUser.id);
  if (existing) return existing;

  const request = fetchStaffProfile(authUser).then((profile) => {
    writeCachedProfile(authUser.id, profile);
    return profile;
  });
  profileRequests.set(authUser.id, request);
  void request.then(
    () => profileRequests.delete(authUser.id),
    () => profileRequests.delete(authUser.id),
  );
  return request;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef<StaffUser | null>(null);
  const authUserIdRef = useRef<string | null>(null);

  const applyUser = useCallback((next: StaffUser | null, authUserId: string | null = null) => {
    userRef.current = next;
    authUserIdRef.current = authUserId;
    setUser(next);
  }, []);

  const restore = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.user) {
        clearCachedProfile();
        applyUser(null);
        return;
      }

      const authUser = data.session.user;
      const cached = readCachedProfile(authUser.id);
      if (cached) {
        applyUser(cached, authUser.id);
        setLoading(false);
      }

      try {
        const profile = await loadStaffProfile(authUser);
        if (!profile.active) throw new Error('Доступ заблоковано');
        applyUser(profile, authUser.id);
      } catch {
        clearCachedProfile();
        try {
          await supabase.auth.signOut();
        } finally {
          applyUser(null);
        }
      }
    } catch {
      // A storage adapter or session bootstrap can fail before Supabase can return
      // its normal { error } envelope. The app must leave the loading screen anyway.
      clearCachedProfile();
      applyUser(null);
    } finally {
      setLoading(false);
    }
  }, [applyUser]);

  useEffect(() => {
    void restore();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;

      if (event === 'SIGNED_OUT' || !session?.user) {
        clearCachedProfile();
        applyUser(null);
        setLoading(false);
        return;
      }

      if (authUserIdRef.current === session.user.id && userRef.current) return;

      setLoading(true);
      void loadStaffProfile(session.user)
        .then((profile) => {
          if (!profile.active) throw new Error('Доступ заблоковано');
          applyUser(profile, session.user.id);
        })
        .catch(async () => {
          clearCachedProfile();
          try {
            await supabase.auth.signOut();
          } finally {
            applyUser(null);
          }
        })
        .finally(() => setLoading(false));
    });
    return () => data.subscription.unsubscribe();
  }, [applyUser, restore]);

  const login = useCallback(async (loginValue: string, password: string) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(edgeFunctionUrl('tiflis-auth-migrate'), {
        method: 'POST',
        headers: {
          apikey: supabasePublishableKey,
          Authorization: `Bearer ${supabasePublishableKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'login', login: loginValue, password }),
        signal: controller.signal,
      });

      let payload: LegacyAuthResponse;
      try {
        payload = (await response.json()) as LegacyAuthResponse;
      } catch {
        throw new Error('Сервер повернув некоректну відповідь.');
      }

      if (!response.ok || !payload.ok || !payload.session || !payload.user) {
        throw new Error(payload.error || 'Не вдалося увійти');
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });
      if (error) throw error;

      const mapped = mapLegacyUser(payload.user);
      const authUserId = data.session?.user.id || null;
      if (authUserId) writeCachedProfile(authUserId, mapped);
      applyUser(mapped, authUserId);
      setLoading(false);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') {
        throw new Error('Сервер відповідає надто довго. Спробуйте ще раз.');
      }
      throw reason;
    } finally {
      window.clearTimeout(timeout);
    }
  }, [applyUser]);

  const logout = useCallback(async () => {
    clearCachedProfile();
    try {
      await supabase.auth.signOut();
    } finally {
      // Even if the auth client/storage layer itself fails, never leave stale
      // privileged UI rendered after the user explicitly pressed “Вийти”.
      applyUser(null);
      setLoading(false);
    }
  }, [applyUser]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
