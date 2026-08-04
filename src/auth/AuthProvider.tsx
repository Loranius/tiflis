import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { edgeFunctionUrl, supabase, supabasePublishableKey } from '../lib/supabase';
import type { LegacyAuthResponse, StaffRole, StaffUser } from '../types';

interface AuthContextValue {
  user: StaffUser | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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

async function loadStaffProfile(authUser: User): Promise<StaffUser> {
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

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);

  const restore = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const profile = await loadStaffProfile(data.session.user);
      if (!profile.active) throw new Error('Доступ заблоковано');
      setUser(profile);
    } catch {
      await supabase.auth.signOut();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void restore();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      void loadStaffProfile(session.user)
        .then(setUser)
        .catch(async () => {
          await supabase.auth.signOut();
          setUser(null);
        })
        .finally(() => setLoading(false));
    });
    return () => data.subscription.unsubscribe();
  }, [restore]);

  const login = useCallback(async (loginValue: string, password: string) => {
    const response = await fetch(edgeFunctionUrl('tiflis-auth-migrate'), {
      method: 'POST',
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${supabasePublishableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'login', login: loginValue, password }),
    });

    const payload = (await response.json()) as LegacyAuthResponse;
    if (!response.ok || !payload.ok || !payload.session || !payload.user) {
      throw new Error(payload.error || 'Не вдалося увійти');
    }

    const { error } = await supabase.auth.setSession({
      access_token: payload.session.access_token,
      refresh_token: payload.session.refresh_token,
    });
    if (error) throw error;

    setUser(mapLegacyUser(payload.user));
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

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
