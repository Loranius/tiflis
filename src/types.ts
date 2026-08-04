export type StaffRole =
  | 'sysadmin'
  | 'admin'
  | 'chef'
  | 'cook'
  | 'waiter'
  | 'bar'
  | 'hostess'
  | 'runner'
  | 'staff';

export interface StaffUser {
  id: string;
  login: string;
  displayName: string;
  role: StaffRole;
  role2: StaffRole | null;
  active: boolean;
  canNotify: boolean;
  avatar: string | null;
}

export interface MigratedSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
}

export interface LegacyAuthResponse {
  ok: boolean;
  error?: string;
  session?: MigratedSession;
  user?: {
    id: string;
    login: string;
    role: string | null;
    role2: string | null;
    display_name: string | null;
    avatar: string | null;
    fired: boolean | null;
    can_notify: boolean | null;
  };
}
