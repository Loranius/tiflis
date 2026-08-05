import {
  BellRing,
  Check,
  Database,
  Eraser,
  FileClock,
  KeyRound,
  LockKeyhole,
  Megaphone,
  RefreshCw,
  Save,
  Send,
  ServerCog,
  ShieldCheck,
  Sparkles,
  UsersRound,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { secureApi } from '../lib/secureApi';
import './admin.css';

type AdminTab = 'overview' | 'notice' | 'system' | 'permissions' | 'audit';
type Priority = 'low' | 'medium' | 'high' | 'critical';

interface AdminMetrics {
  activeStaff: number;
  archivedStaff: number;
  authOnlyStaff: number;
  legacyStaff: number;
  linkedProfiles: number;
  menuItems: number;
  stoppedItems: number;
  todayReservations: number;
  upcomingReservations: number;
  scheduleRows: number;
}

interface PortalConfig {
  id: boolean;
  portal_name: string;
  maintenance_mode: boolean;
  announcement_enabled: boolean;
  announcement_title: string | null;
  announcement_body: string | null;
  announcement_priority: Priority;
  updated_by: string | null;
  updated_at: string;
}

interface NotificationRow {
  id: number;
  title: string;
  body: string | null;
  priority: Priority | null;
  author: string;
  roles: string | null;
  expires_at: string | null;
  created_at: string | null;
}

interface AuditRow {
  id: number;
  actor_id: string | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface RoleMatrixRow {
  role: string;
  label: string;
  pages: string[];
  actions: string[];
}

interface ModuleRow {
  key: string;
  label: string;
  api: string;
}

interface AdminBootstrapResponse {
  ok: true;
  metrics: AdminMetrics;
  config: PortalConfig;
  notifications: NotificationRow[];
  audit: AuditRow[];
  roleMatrix: RoleMatrixRow[];
  modules: ModuleRow[];
}

interface NoticeEditor {
  title: string;
  body: string;
  priority: Priority;
  roles: string[];
  expiresAt: string;
  telegram: boolean;
}

const PAGE_LABELS: Record<string, string> = {
  today: 'Головна',
  schedule: 'Графік',
  cash: 'Каса',
  menu: 'Меню',
  reserve: 'Резерви',
  staff: 'Персонал',
  admin: 'Управління',
};

const ACTION_LABELS: Record<string, string> = {
  all: 'Усі дії',
  editSchedule: 'Редагувати графік',
  editOwnShift: 'Редагувати свій рядок',
  toggleStop: 'Керувати стоп-листом',
  editMenu: 'Редагувати меню',
  manageReserve: 'Керувати резервами',
  manageUsers: 'Керувати персоналом',
  seeAllCash: 'Бачити всю касу',
  broadcast: 'Публікувати повідомлення',
};

const ROLE_OPTIONS = [
  ['admin', 'Адміністрація'],
  ['chef', 'Шеф-кухар'],
  ['cook', 'Кухня'],
  ['waiter', 'Офіціанти'],
  ['bar', 'Бар'],
  ['hostess', 'Хостес'],
  ['runner', 'Ранери'],
  ['sommelier', 'Сомельє'],
] as const;

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function initialNotice(): NoticeEditor {
  return {
    title: '',
    body: '',
    priority: 'medium',
    roles: [],
    expiresAt: '',
    telegram: false,
  };
}

export function AdminPage() {
  const [data, setData] = useState<AdminBootstrapResponse | null>(null);
  const [tab, setTab] = useState<AdminTab>('overview');
  const [config, setConfig] = useState<PortalConfig | null>(null);
  const [notice, setNotice] = useState<NoticeEditor>(() => initialNotice());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await secureApi<AdminBootstrapResponse>(
        { action: 'admin_bootstrap' },
        'tiflis-admin-api',
      );
      setData(response);
      setConfig(response.config);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити центр управління.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const authProgress = useMemo(() => {
    const total = (data?.metrics.authOnlyStaff || 0) + (data?.metrics.legacyStaff || 0);
    return total > 0 ? Math.round(((data?.metrics.authOnlyStaff || 0) / total) * 100) : 100;
  }, [data]);

  function flash(message: string) {
    setSuccess(message);
    window.setTimeout(() => setSuccess(null), 2400);
  }

  async function saveConfig() {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const response = await secureApi<{ ok: true; config: PortalConfig }>({
        action: 'admin_save_config',
        portal_name: config.portal_name,
        maintenance_mode: config.maintenance_mode,
        announcement_enabled: config.announcement_enabled,
        announcement_title: config.announcement_title || '',
        announcement_body: config.announcement_body || '',
        announcement_priority: config.announcement_priority,
      }, 'tiflis-admin-api');
      setConfig(response.config);
      flash('Конфігурацію збережено');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Конфігурацію не збережено.');
    } finally {
      setSaving(false);
    }
  }

  async function publishNotice() {
    if (!notice.title.trim() || !notice.body.trim()) {
      setError('Вкажіть заголовок і текст повідомлення.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await secureApi<{
        ok: true;
        telegramSent: number;
        telegramSkipped: number;
      }>({
        action: 'admin_publish_notification',
        title: notice.title,
        body: notice.body,
        priority: notice.priority,
        roles: notice.roles,
        expires_at: notice.expiresAt ? new Date(notice.expiresAt).toISOString() : '',
        telegram: notice.telegram,
      }, 'tiflis-admin-api');
      setNotice(initialNotice());
      flash(notice.telegram
        ? `Опубліковано · Telegram: ${response.telegramSent} доставлено`
        : 'Повідомлення опубліковано');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Повідомлення не опубліковано.');
    } finally {
      setSaving(false);
    }
  }

  async function cleanupNotifications() {
    setSaving(true);
    setError(null);
    try {
      const response = await secureApi<{ ok: true; removed: number }>({
        action: 'admin_cleanup_notifications',
      }, 'tiflis-admin-api');
      flash(`Видалено прострочених: ${response.removed}`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Очищення не виконано.');
    } finally {
      setSaving(false);
    }
  }

  async function scrubCredentials() {
    setSaving(true);
    setError(null);
    try {
      const response = await secureApi<{ ok: true; scrubbed: number }>({
        action: 'admin_scrub_linked_credentials',
      }, 'tiflis-admin-api');
      flash(`Знищено legacy-паролів: ${response.scrubbed}`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Очищення доступів не виконано.');
    } finally {
      setSaving(false);
    }
  }

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Огляд', icon: <Sparkles size={16} /> },
    { key: 'notice', label: 'Оголошення', icon: <Megaphone size={16} /> },
    { key: 'system', label: 'Система', icon: <ServerCog size={16} /> },
    { key: 'permissions', label: 'Права', icon: <ShieldCheck size={16} /> },
    { key: 'audit', label: 'Аудит', icon: <FileClock size={16} /> },
  ];

  return (
    <div className="admin-page-v2">
      <section className="admin-hero-v2">
        <div>
          <span className="eyebrow">Operations center</span>
          <h2>Керування без доступу до секретів</h2>
          <p>Стан модулів, Auth-міграція, повідомлення, конфігурація, матриця прав та незмінний журнал адміністративних дій.</p>
        </div>
        <div className="admin-hero-mark"><ServerCog size={36} /></div>
      </section>

      <nav className="admin-tabs-v2" aria-label="Розділи управління">
        {tabs.map((item) => (
          <button type="button" key={item.key} className={tab === item.key ? 'is-active' : ''} onClick={() => setTab(item.key)}>
            {item.icon}{item.label}
          </button>
        ))}
      </nav>

      {error ? <div className="admin-alert-v2 is-error"><span>{error}</span><button type="button" onClick={() => setError(null)}><X size={16} /></button></div> : null}
      {success ? <div className="admin-alert-v2 is-success"><Check size={17} /><span>{success}</span></div> : null}
      {loading ? <div className="admin-loading-v2"><RefreshCw size={24} className="is-spinning" /><span>Збираємо стан системи…</span></div> : null}

      {!loading && data && tab === 'overview' ? (
        <div className="admin-overview-v2">
          <section className="admin-metrics-v2">
            <article><UsersRound size={20} /><span>Активна команда</span><strong>{data.metrics.activeStaff}</strong><small>{data.metrics.archivedStaff} в архіві</small></article>
            <article><KeyRound size={20} /><span>Auth-only</span><strong>{authProgress}%</strong><small>{data.metrics.legacyStaff} legacy-акаунтів</small></article>
            <article><UtensilsCrossed size={20} /><span>Меню</span><strong>{data.metrics.menuItems}</strong><small>{data.metrics.stoppedItems} у стопі</small></article>
            <article><BellRing size={20} /><span>Резерви сьогодні</span><strong>{data.metrics.todayReservations}</strong><small>{data.metrics.upcomingReservations} на 30 днів</small></article>
          </section>

          <section className="admin-grid-v2">
            <article className="admin-panel-v2">
              <div className="admin-panel-heading-v2"><div><span className="eyebrow">Production</span><h3>Модулі</h3></div><Database size={22} /></div>
              <div className="admin-module-list-v2">
                {data.modules.map((module) => <div key={module.key}><span><Check size={14} /></span><div><strong>{module.label}</strong><small>{module.api}</small></div><b>ACTIVE</b></div>)}
              </div>
            </article>

            <article className="admin-panel-v2">
              <div className="admin-panel-heading-v2"><div><span className="eyebrow">Останнє</span><h3>Повідомлення</h3></div><BellRing size={22} /></div>
              <div className="admin-notification-list-v2">
                {data.notifications.slice(0, 6).map((item) => <div key={item.id} className={`priority-${item.priority || 'medium'}`}><span /><div><strong>{item.title}</strong><p>{item.body || 'Без тексту'}</p><small>{item.author} · {formatDate(item.created_at)}</small></div></div>)}
                {data.notifications.length === 0 ? <p className="admin-muted-v2">Повідомлень ще немає.</p> : null}
              </div>
            </article>
          </section>
        </div>
      ) : null}

      {!loading && data && config && tab === 'notice' ? (
        <div className="admin-two-column-v2">
          <section className="admin-panel-v2 admin-form-v2">
            <div className="admin-panel-heading-v2"><div><span className="eyebrow">Нова публікація</span><h3>Повідомлення команді</h3></div><Megaphone size={22} /></div>
            <label><span>Заголовок</span><input value={notice.title} onChange={(event) => setNotice({ ...notice, title: event.target.value })} maxLength={180} /></label>
            <label><span>Текст</span><textarea value={notice.body} onChange={(event) => setNotice({ ...notice, body: event.target.value })} maxLength={3500} /></label>
            <div className="admin-form-row-v2">
              <label><span>Пріоритет</span><select value={notice.priority} onChange={(event) => setNotice({ ...notice, priority: event.target.value as Priority })}><option value="low">Низький</option><option value="medium">Звичайний</option><option value="high">Важливий</option><option value="critical">Критичний</option></select></label>
              <label><span>Діє до</span><input type="datetime-local" value={notice.expiresAt} onChange={(event) => setNotice({ ...notice, expiresAt: event.target.value })} /></label>
            </div>
            <div className="admin-role-picker-v2"><strong>Отримувачі</strong><span>Порожній вибір означає всю команду.</span><div>{ROLE_OPTIONS.map(([key, label]) => { const active = notice.roles.includes(key); return <button type="button" key={key} className={active ? 'is-active' : ''} onClick={() => setNotice({ ...notice, roles: active ? notice.roles.filter((role) => role !== key) : [...notice.roles, key] })}>{active ? <Check size={13} /> : null}{label}</button>; })}</div></div>
            <label className="admin-toggle-v2"><input type="checkbox" checked={notice.telegram} onChange={(event) => setNotice({ ...notice, telegram: event.target.checked })} /><span><Send size={17} /><b>Також надіслати в Telegram</b><small>Лише працівникам із прив’язаним chat ID.</small></span></label>
            <button type="button" className="admin-primary-v2" onClick={() => void publishNotice()} disabled={saving}>{saving ? <RefreshCw size={17} className="is-spinning" /> : <Send size={17} />} Опублікувати</button>
          </section>

          <section className="admin-panel-v2">
            <div className="admin-panel-heading-v2"><div><span className="eyebrow">Історія</span><h3>Останні публікації</h3></div><button type="button" className="admin-compact-action-v2" onClick={() => void cleanupNotifications()} disabled={saving}><Eraser size={15} /> Очистити прострочені</button></div>
            <div className="admin-notification-list-v2 is-long">
              {data.notifications.map((item) => <div key={item.id} className={`priority-${item.priority || 'medium'}`}><span /><div><strong>{item.title}</strong><p>{item.body || 'Без тексту'}</p><small>{item.author} · {formatDate(item.created_at)}{item.roles ? ` · ${item.roles}` : ' · усі'}</small></div></div>)}
            </div>
          </section>
        </div>
      ) : null}

      {!loading && data && config && tab === 'system' ? (
        <div className="admin-two-column-v2">
          <section className="admin-panel-v2 admin-form-v2">
            <div className="admin-panel-heading-v2"><div><span className="eyebrow">Typed config</span><h3>Поведінка порталу</h3></div><ServerCog size={22} /></div>
            <label><span>Назва порталу</span><input value={config.portal_name} onChange={(event) => setConfig({ ...config, portal_name: event.target.value })} maxLength={80} /></label>
            <label className="admin-toggle-v2"><input type="checkbox" checked={config.maintenance_mode} onChange={(event) => setConfig({ ...config, maintenance_mode: event.target.checked })} /><span><LockKeyhole size={17} /><b>Режим технічних робіт</b><small>Прапорець готовий для майбутнього deployment gate.</small></span></label>
            <label className="admin-toggle-v2"><input type="checkbox" checked={config.announcement_enabled} onChange={(event) => setConfig({ ...config, announcement_enabled: event.target.checked })} /><span><Megaphone size={17} /><b>Глобальний банер</b><small>Показувати закріплене оголошення у порталі.</small></span></label>
            <label><span>Заголовок банера</span><input value={config.announcement_title || ''} onChange={(event) => setConfig({ ...config, announcement_title: event.target.value })} maxLength={180} /></label>
            <label><span>Текст банера</span><textarea value={config.announcement_body || ''} onChange={(event) => setConfig({ ...config, announcement_body: event.target.value })} maxLength={3500} /></label>
            <label><span>Пріоритет банера</span><select value={config.announcement_priority} onChange={(event) => setConfig({ ...config, announcement_priority: event.target.value as Priority })}><option value="low">Низький</option><option value="medium">Звичайний</option><option value="high">Важливий</option><option value="critical">Критичний</option></select></label>
            <button type="button" className="admin-primary-v2" onClick={() => void saveConfig()} disabled={saving}>{saving ? <RefreshCw size={17} className="is-spinning" /> : <Save size={17} />} Зберегти конфігурацію</button>
          </section>

          <section className="admin-panel-v2">
            <div className="admin-panel-heading-v2"><div><span className="eyebrow">Credential migration</span><h3>Стан Auth</h3></div><KeyRound size={22} /></div>
            <div className="admin-progress-v2"><div><span>Переведено в Auth-only</span><strong>{authProgress}%</strong></div><progress max="100" value={authProgress} /></div>
            <div className="admin-stat-list-v2"><div><span>Auth-only акаунти</span><strong>{data.metrics.authOnlyStaff}</strong></div><div><span>Legacy-акаунти</span><strong>{data.metrics.legacyStaff}</strong></div><div><span>Пов’язані staff_profiles</span><strong>{data.metrics.linkedProfiles}</strong></div><div><span>Майбутніх змін у графіку</span><strong>{data.metrics.scheduleRows}</strong></div></div>
            <button type="button" className="admin-danger-action-v2" onClick={() => void scrubCredentials()} disabled={saving || data.metrics.linkedProfiles === 0}><Eraser size={16} /> Знищити legacy-паролі вже пов’язаних акаунтів</button>
            <p className="admin-footnote-v2">Дія не зачіпає працівників, які ще не виконали перший вхід, і не показує жодних паролів.</p>
          </section>
        </div>
      ) : null}

      {!loading && data && tab === 'permissions' ? (
        <section className="admin-panel-v2">
          <div className="admin-panel-heading-v2"><div><span className="eyebrow">Read-only registry</span><h3>Матриця ролей</h3></div><ShieldCheck size={22} /></div>
          <p className="admin-muted-v2">Права визначені в коді та серверних API. Їх не можна випадково змінити через браузер.</p>
          <div className="admin-permission-grid-v2">
            {data.roleMatrix.map((row) => <article key={row.role}><header><span>{row.label.slice(0, 1)}</span><div><strong>{row.label}</strong><small>{row.role}</small></div></header><div><b>Сторінки</b><p>{row.pages.map((page) => PAGE_LABELS[page] || page).join(' · ') || 'Лише головна'}</p></div><div><b>Дії</b><p>{row.actions.map((action) => ACTION_LABELS[action] || action).join(' · ') || 'Без адміністративних дій'}</p></div></article>)}
          </div>
        </section>
      ) : null}

      {!loading && data && tab === 'audit' ? (
        <section className="admin-panel-v2">
          <div className="admin-panel-heading-v2"><div><span className="eyebrow">Immutable history</span><h3>Журнал адміністративних дій</h3></div><FileClock size={22} /></div>
          <div className="admin-audit-list-v2">
            {data.audit.map((item) => <article key={item.id}><span><FileClock size={15} /></span><div><strong>{item.summary}</strong><p>{item.actor_name} · {item.entity_type}{item.entity_id ? ` #${item.entity_id}` : ''}</p><small>{formatDate(item.created_at)} · {item.action}</small></div></article>)}
            {data.audit.length === 0 ? <p className="admin-muted-v2">Журнал ще порожній.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
