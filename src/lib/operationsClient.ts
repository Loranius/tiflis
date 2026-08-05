import { secureApi } from './secureApi';

export type TaskStatus = 'pending' | 'done' | 'skipped';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type TaskCategory = 'opening' | 'service' | 'closing' | 'handover';

export interface TaskAssignment {
  id: number;
  template_id: number;
  work_date: string;
  assignee_id: string;
  status: TaskStatus;
  note: string | null;
  completed_by: string | null;
  completed_at: string | null;
}

export interface OperationTask {
  id: number;
  title: string;
  description: string | null;
  category: TaskCategory;
  role_scope: string[] | null;
  shift_codes: string[] | null;
  sort_order: number;
  active: boolean;
  assignment: TaskAssignment | null;
}

export interface OperationsPerson {
  id: string;
  name: string;
  roles?: string[];
  role?: string;
  role2?: string | null;
  avatar?: string | null;
  shift: string | null;
}

export interface HandoverNote {
  id: number;
  work_date: string;
  author_id: string | null;
  author_name: string;
  title: string;
  body: string;
  priority: Priority;
  role_scope: string[] | null;
  pinned: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export interface OperationsResponse {
  ok: true;
  date: string;
  me: OperationsPerson;
  subject?: OperationsPerson;
  permissions: { canManageTemplates: boolean; canResolveAny: boolean };
  tasks: OperationTask[];
  team: OperationsPerson[];
  notes: HandoverNote[];
  notifications: unknown[];
}

export const CATEGORY_META: Record<TaskCategory, { label: string; icon: string }> = {
  opening: { label: 'Перед відкриттям', icon: '☀️' },
  service: { label: 'Під час сервісу', icon: '🍽️' },
  closing: { label: 'Закриття', icon: '🌙' },
  handover: { label: 'Передача зміни', icon: '↗' },
};

export const ROLE_OPTIONS = [
  ['admin', 'Адміністрація'],
  ['chef', 'Шеф'],
  ['cook', 'Кухня'],
  ['waiter', 'Офіціанти'],
  ['bar', 'Бар'],
  ['hostess', 'Хостес'],
  ['runner', 'Ранери'],
  ['sommelier', 'Сомельє'],
] as const;

export function localIso(date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function addDays(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localIso(date);
}

export function formatDate(value: string, withYear = false): string {
  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'long', day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' as const } : {}),
  }).format(new Date(`${value}T12:00:00`));
}

export function formatMoment(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

export function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '').join('');
}

export function roleLabel(value: string): string {
  const labels: Record<string, string> = {
    admin: 'Адміністрація', sysadmin: 'Сисадмін', chef: 'Шеф', cook: 'Кухня',
    waiter: 'Офіціант', bar: 'Бар', hostess: 'Хостес', runner: 'Ранер', sommelier: 'Сомельє',
  };
  return labels[value] || value;
}

export function escapeTelegram(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function loadOperations(date: string, userId?: string): Promise<OperationsResponse> {
  return secureApi<OperationsResponse>({
    action: 'operations_bootstrap', date, ...(userId ? { user_id: userId } : {}),
  }, 'tiflis-operations-api');
}

export function setOperationTask(assignmentId: number, status: TaskStatus): Promise<{ ok: true }> {
  return secureApi<{ ok: true }>({
    action: 'operations_set_task', assignment_id: assignmentId, status,
  }, 'tiflis-operations-api');
}

export function addHandoverNote(input: {
  date: string;
  title: string;
  body: string;
  priority: Priority;
  roleScope: string[];
}): Promise<{ ok: true }> {
  return secureApi<{ ok: true }>({
    action: 'operations_add_note',
    date: input.date,
    title: input.title,
    body: input.body,
    priority: input.priority,
    role_scope: input.roleScope,
  }, 'tiflis-operations-api');
}

export function resolveHandoverNote(id: number, resolved: boolean): Promise<{ ok: true }> {
  return secureApi<{ ok: true }>({
    action: 'operations_resolve_note', id, resolved,
  }, 'tiflis-operations-api');
}

export function broadcastOperations(text: string, roles: string[] = []): Promise<{ ok: true; sent: number; skipped: number }> {
  return secureApi<{ ok: true; sent: number; skipped: number }>({
    action: 'broadcast', text, roles,
  }, 'tiflis-secure-api');
}
