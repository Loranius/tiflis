import {
  BadgeCheck,
  BriefcaseBusiness,
  Cake,
  CalendarDays,
  Check,
  Copy,
  Edit3,
  KeyRound,
  LockKeyhole,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserRoundX,
  UsersRound,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { secureApi } from '../lib/secureApi';
import { StaffBirthdaysTab } from './StaffBirthdaysTab';
import './staff.css';

type StaffPageTab = 'team' | 'birthdays';

interface StaffRoleOption {
  key: string;
  label: string;
}

interface StaffShift {
  date: string;
  shift: string;
}

interface StaffMember {
  id: string;
  login: string;
  displayName: string;
  nick: string | null;
  avatar: string | null;
  role: string;
  role2: string | null;
  displayRole: string | null;
  telegramUsername: string | null;
  telegramLinked: boolean;
  instagram: string | null;
  fired: boolean;
  createdAt: string | null;
  birthday: string | null;
  traineeDays: number;
  zodiac: string | null;
  canNotify: boolean;
  credo: string | null;
  credentialSource: 'legacy' | 'auth' | string;
  authLinked: boolean;
  nextShift: StaffShift | null;
  monthShiftCount: number;
}

interface StaffBootstrapResponse {
  ok: true;
  me: { legacyUserId: string; canManage: boolean };
  roles: StaffRoleOption[];
  users: StaffMember[];
}

interface StaffEditor {
  mode: 'create' | 'edit';
  id: string | null;
  login: string;
  displayName: string;
  nick: string;
  avatar: string;
  role: string;
  role2: string;
  displayRole: string;
  telegramUsername: string;
  instagram: string;
  birthday: string;
  traineeDays: number;
  canNotify: boolean;
  credo: string;
}

interface CredentialResult {
  login: string;
  password: string;
  title: string;
}

const ROLE_META: Record<string, { label: string; icon: string; order: number }> = {
  sysadmin: { label: 'Сисадмін', icon: '⌘', order: 0 },
  admin: { label: 'Адміністрація', icon: '🛡️', order: 1 },
  chef: { label: 'Шеф-кухар', icon: '👨‍🍳', order: 2 },
  cook: { label: 'Кухня', icon: '🍳', order: 3 },
  waiter: { label: 'Офіціант', icon: '🍽️', order: 4 },
  sommelier: { label: 'Сомельє', icon: '🍷', order: 5 },
  barman: { label: 'Бар', icon: '🍸', order: 6 },
  bar: { label: 'Бар', icon: '🍸', order: 6 },
  hostess: { label: 'Хостес', icon: '✨', order: 7 },
  runner: { label: 'Ранер', icon: '🏃', order: 8 },
  trainee: { label: 'Стажер', icon: '🌱', order: 9 },
  staff: { label: 'Працівник', icon: '👤', order: 10 },
};

function roleLabel(role: string | null): string {
  if (!role) return 'Без другої ролі';
  return ROLE_META[role]?.label || role;
}

function roleIcon(role: string): string {
  return ROLE_META[role]?.icon || '👤';
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '').join('');
}

function formatDate(value: string | null): string {
  if (!value) return 'Не вказано';
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`));
}

function formatShift(value: StaffShift | null): string {
  if (!value) return 'Не призначено';
  const date = new Intl.DateTimeFormat('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(`${value.date}T12:00:00`));
  return `${date} · ${value.shift}`;
}

function tenure(value: string | null): string {
  if (!value) return 'Дата початку не вказана';
  const started = new Date(value).getTime();
  if (!Number.isFinite(started)) return 'Дата початку не вказана';
  const days = Math.max(0, Math.floor((Date.now() - started) / 86_400_000));
  if (days < 31) return `${days} дн. у команді`;
  if (days < 365) return `${Math.floor(days / 30)} міс. у команді`;
  return `${Math.floor(days / 365)} р. у команді`;
}

function createEditor(member?: StaffMember): StaffEditor {
  return {
    mode: member ? 'edit' : 'create',
    id: member?.id || null,
    login: member?.login || '',
    displayName: member?.displayName || '',
    nick: member?.nick || '',
    avatar: member?.avatar || '',
    role: member?.role === 'sysadmin' ? 'admin' : member?.role || 'waiter',
    role2: member?.role2 || '',
    displayRole: member?.displayRole || '',
    telegramUsername: member?.telegramUsername || '',
    instagram: member?.instagram || '',
    birthday: member?.birthday || '',
    traineeDays: member?.traineeDays || 0,
    canNotify: member?.canNotify || false,
    credo: member?.credo || '',
  };
}

export function StaffPage() {
  const [tab, setTab] = useState<StaffPageTab>('team');
  const [data, setData] = useState<StaffBootstrapResponse | null>(null);
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [portrait, setPortrait] = useState<StaffMember | null>(null);
  const [editor, setEditor] = useState<StaffEditor | null>(null);
  const [credential, setCredential] = useState<CredentialResult | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await secureApi<StaffBootstrapResponse>(
        { action: 'staff_bootstrap' },
        'tiflis-staff-api',
      );
      setData(response);
      setMembers(response.users);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити персонал.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const roles = useMemo(() => {
    const options = new Map<string, string>();
    data?.roles.forEach((role) => options.set(role.key, role.label));
    members.forEach((member) => {
      options.set(member.role, roleLabel(member.role));
      if (member.role2) options.set(member.role2, roleLabel(member.role2));
    });
    return [...options.entries()].sort(([left], [right]) => {
      return (ROLE_META[left]?.order ?? 999) - (ROLE_META[right]?.order ?? 999)
        || roleLabel(left).localeCompare(roleLabel(right), 'uk');
    });
  }, [data, members]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('uk-UA');
    return members.filter((member) => {
      if (!showArchived && member.fired) return false;
      if (showArchived && !member.fired) return false;
      if (roleFilter !== 'all' && member.role !== roleFilter && member.role2 !== roleFilter) return false;
      if (!query) return true;
      return [
        member.displayName,
        member.login,
        member.nick || '',
        roleLabel(member.role),
        roleLabel(member.role2),
        member.telegramUsername || '',
        member.instagram || '',
      ].join(' ').toLocaleLowerCase('uk-UA').includes(query);
    }).sort((left, right) => {
      const leftOrder = ROLE_META[left.role]?.order ?? 999;
      const rightOrder = ROLE_META[right.role]?.order ?? 999;
      return leftOrder - rightOrder || left.displayName.localeCompare(right.displayName, 'uk');
    });
  }, [members, roleFilter, search, showArchived]);

  const metrics = useMemo(() => {
    const active = members.filter((member) => !member.fired);
    const authLinked = active.filter((member) => member.authLinked).length;
    const telegram = active.filter((member) => member.telegramLinked).length;
    const birthdays = active.filter((member) => member.birthday).length;
    return { active: active.length, authLinked, telegram, birthdays, archived: members.length - active.length };
  }, [members]);

  async function saveProfile() {
    if (!editor || !data) return;
    if (!editor.login.trim() || !editor.displayName.trim()) {
      setError('Вкажіть логін та імʼя працівника.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editor.mode === 'create') {
        const response = await secureApi<{ ok: true; login: string; temporaryPassword: string }>({
          action: 'staff_create',
          login: editor.login,
          display_name: editor.displayName,
          nick: editor.nick,
          avatar: editor.avatar,
          role: editor.role,
          role2: editor.role2,
          display_role: editor.displayRole,
          tg_username: editor.telegramUsername,
          instagram: editor.instagram,
          birthday: editor.birthday,
          trainee_days: editor.traineeDays,
          can_notify: editor.canNotify,
          credo: editor.credo,
        }, 'tiflis-staff-api');
        setCredential({ login: response.login, password: response.temporaryPassword, title: 'Доступ нового працівника' });
      } else {
        await secureApi<{ ok: true }>({
          action: 'staff_save',
          user_id: editor.id,
          login: editor.login,
          display_name: editor.displayName,
          nick: editor.nick,
          avatar: editor.avatar,
          role: editor.role,
          role2: editor.role2,
          display_role: editor.displayRole,
          tg_username: editor.telegramUsername,
          instagram: editor.instagram,
          birthday: editor.birthday,
          trainee_days: editor.traineeDays,
          can_notify: editor.canNotify,
          credo: editor.credo,
        }, 'tiflis-staff-api');
      }
      setEditor(null);
      setSelected(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Профіль не збережено.');
    } finally {
      setSaving(false);
    }
  }

  async function setActive(member: StaffMember, active: boolean) {
    setSaving(true);
    setError(null);
    try {
      await secureApi<{ ok: true }>({
        action: 'staff_set_active', user_id: member.id, active,
      }, 'tiflis-staff-api');
      setSelected(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Статус не змінено.');
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(member: StaffMember) {
    setSaving(true);
    setError(null);
    try {
      const response = await secureApi<{ ok: true; temporaryPassword: string }>({
        action: 'staff_reset_password', user_id: member.id,
      }, 'tiflis-staff-api');
      setCredential({ login: member.login, password: response.temporaryPassword, title: 'Новий тимчасовий пароль' });
      setSelected(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Пароль не оновлено.');
    } finally {
      setSaving(false);
    }
  }

  async function copyCredentials() {
    if (!credential) return;
    await navigator.clipboard.writeText(`Логін: ${credential.login}\nТимчасовий пароль: ${credential.password}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const canEditSelected = Boolean(
    selected && data && (data.me.canManage || selected.id === data.me.legacyUserId),
  );

  return (
    <div className="staff-page-v2">
      <section className="staff-hero-v2">
        <div><span className="eyebrow">Команда ресторану</span><h2>Люди, ролі та доступ</h2><p>Робочі профілі, зміни, Telegram, друга роль і захищені Auth-акаунти без показу старих паролів у браузері.</p></div>
        <div className="staff-hero-mark"><UsersRound size={36} /></div>
      </section>

      <nav className="staff-tabs-v1" role="tablist" aria-label="Розділи персоналу">
        <button type="button" role="tab" aria-selected={tab === 'team'} className={tab === 'team' ? 'is-active' : ''} onClick={() => setTab('team')}><UsersRound size={16} /> Команда</button>
        <button type="button" role="tab" aria-selected={tab === 'birthdays'} className={tab === 'birthdays' ? 'is-active' : ''} onClick={() => setTab('birthdays')}><Cake size={16} /> День народження</button>
      </nav>

      {tab === 'birthdays' ? <StaffBirthdaysTab /> : null}

      {tab === 'team' ? <>
      <section className="staff-command-v2">
        <label className="staff-search-v2"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Імʼя, логін, роль або соцмережа…" />{search ? <button type="button" onClick={() => setSearch('')}><X size={15} /></button> : null}</label>
        <label className="staff-role-filter-v2"><span>Роль</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">Уся команда</option>{roles.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <button type="button" className={showArchived ? 'is-archive-active' : ''} onClick={() => setShowArchived((value) => !value)}><UserRoundX size={17} /> {showArchived ? `Архів ${metrics.archived}` : 'Показати архів'}</button>
        {data?.me.canManage ? <button type="button" className="staff-add-v2" onClick={() => setEditor(createEditor())}><Plus size={18} /> Новий працівник</button> : null}
      </section>

      <section className="staff-metrics-v2">
        <article><UserCheck size={19} /><span>Активна команда</span><strong>{metrics.active}</strong></article>
        <article><ShieldCheck size={19} /><span>Auth підключено</span><strong>{metrics.authLinked}</strong></article>
        <article><MessageCircle size={19} /><span>Telegram зв’язано</span><strong>{metrics.telegram}</strong></article>
        <article><Cake size={19} /><span>Дні народження</span><strong>{metrics.birthdays}</strong></article>
      </section>

      {error ? <div className="staff-alert-v2" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)}><X size={16} /></button></div> : null}
      {loading ? <div className="staff-loading-v2"><RefreshCw size={24} className="is-spinning" /><span>Збираємо команду…</span></div> : null}

      {!loading ? <section className="staff-grid-v2">
        {filtered.length === 0 ? <div className="staff-empty-v2"><UsersRound size={30} /><strong>Нікого не знайдено</strong><span>Змініть пошук, роль або режим архіву.</span></div> : null}
        {filtered.map((member) => <article key={member.id} className={`${member.fired ? 'is-fired' : ''} ${member.id === data?.me.legacyUserId ? 'is-me' : ''}`}>
          <button type="button" className="staff-card-main-v2" onClick={() => setSelected(member)}>
            <div className="staff-avatar-v2">{member.avatar ? <img src={member.avatar} alt="" loading="lazy" /> : <span>{initials(member.displayName)}</span>}<i>{roleIcon(member.role)}</i></div>
            <div className="staff-card-copy-v2"><div><span>{member.displayRole || roleLabel(member.role)}</span>{member.id === data?.me.legacyUserId ? <b>Ви</b> : null}</div><h3>{member.displayName}</h3>{member.nick ? <p>«{member.nick}»</p> : <p>{tenure(member.createdAt)}</p>}<div className="staff-badges-v2"><span className={member.authLinked ? 'is-ok' : 'is-warn'}>{member.authLinked ? <BadgeCheck size={12} /> : <LockKeyhole size={12} />}{member.authLinked ? 'Auth' : 'Legacy'}</span>{member.role2 ? <span>{roleLabel(member.role2)}</span> : null}{member.telegramLinked ? <span><MessageCircle size={12} /> TG</span> : null}</div></div>
          </button>
          <div className="staff-card-footer-v2"><span><CalendarDays size={14} /><b>{formatShift(member.nextShift)}</b></span><span>{member.monthShiftCount} змін цього місяця</span></div>
        </article>)}
      </section> : null}

      {selected ? <div className="staff-sheet-backdrop-v2" onMouseDown={() => setSelected(null)}><section className="staff-detail-sheet-v2" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="staff-detail-hero-v2"><button type="button" className="staff-detail-avatar-v2" onClick={() => setPortrait(selected)} aria-label={`Відкрити фото ${selected.displayName} на весь екран`}>{selected.avatar ? <img src={selected.avatar} alt={selected.displayName} /> : <span>{initials(selected.displayName)}</span>}<i>Розгорнути</i></button><div><span className="eyebrow">{selected.displayRole || roleLabel(selected.role)}</span><h3>{selected.displayName}</h3><p>@{selected.login}{selected.nick ? ` · «${selected.nick}»` : ''}</p></div><button type="button" onClick={() => setSelected(null)}><X size={19} /></button></div>
        <div className="staff-detail-status-v2"><span className={selected.authLinked ? 'is-ok' : 'is-warn'}>{selected.authLinked ? <BadgeCheck size={16} /> : <LockKeyhole size={16} />}{selected.authLinked ? 'Захищений Auth-акаунт' : 'Очікує першого входу'}</span><span>{selected.fired ? 'В архіві' : 'Активний працівник'}</span></div>
        <div className="staff-detail-grid-v2"><article><CalendarDays size={18} /><span>Наступна зміна</span><strong>{formatShift(selected.nextShift)}</strong></article><article><BriefcaseBusiness size={18} /><span>За місяць</span><strong>{selected.monthShiftCount} змін</strong></article><article><Cake size={18} /><span>День народження</span><strong>{formatDate(selected.birthday)}</strong></article><article><Sparkles size={18} /><span>У команді</span><strong>{tenure(selected.createdAt)}</strong></article></div>
        {selected.credo ? <blockquote>“{selected.credo}”</blockquote> : null}
        <div className="staff-socials-v2">{selected.telegramUsername ? <span><MessageCircle size={15} /> @{selected.telegramUsername}</span> : null}{selected.instagram ? <span><span aria-hidden="true">IG</span> @{selected.instagram}</span> : null}{!selected.telegramUsername && !selected.instagram ? <span>Соцмережі не вказані</span> : null}</div>
        <div className="staff-detail-actions-v2">{data?.me.canManage && selected.id !== 'sysadmin' ? <button type="button" className={selected.fired ? 'is-activate' : 'is-archive'} onClick={() => void setActive(selected, selected.fired)} disabled={saving}>{selected.fired ? <UserCheck size={17} /> : <UserRoundX size={17} />}{selected.fired ? 'Повернути в команду' : 'Перенести в архів'}</button> : <span />}{data?.me.canManage && selected.authLinked ? <button type="button" className="is-key" onClick={() => void resetPassword(selected)} disabled={saving}><KeyRound size={17} /> Скинути пароль</button> : null}{canEditSelected ? <button type="button" className="is-edit" onClick={() => { setEditor(createEditor(selected)); setSelected(null); }}><Edit3 size={17} /> Редагувати</button> : null}</div>
      </section></div> : null}

      {portrait ? <div className="staff-portrait-backdrop-v3" onMouseDown={() => setPortrait(null)}><section className="staff-portrait-sheet-v3" role="dialog" aria-modal="true" aria-label={`Фото ${portrait.displayName}`} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="staff-portrait-close-v3" onClick={() => setPortrait(null)} aria-label="Закрити фото"><X size={22} /></button>
        <div className={`staff-portrait-media-v3 ${portrait.avatar ? 'has-photo' : 'has-initials'}`}>
          {portrait.avatar ? <img src={portrait.avatar} alt={portrait.displayName} /> : <span>{initials(portrait.displayName)}</span>}
        </div>
        <footer className="staff-portrait-copy-v3">
          <span className="eyebrow">{portrait.displayRole || [roleLabel(portrait.role), portrait.role2 ? roleLabel(portrait.role2) : null].filter(Boolean).join(' · ')}</span>
          <h3>{portrait.displayName}</h3>
          <blockquote>{portrait.credo ? '“' + portrait.credo + '”' : 'Життєве кредо не вказано.'}</blockquote>
        </footer>
      </section></div> : null}

      {editor ? <div className="staff-sheet-backdrop-v2" onMouseDown={() => !saving && setEditor(null)}><section className="staff-editor-sheet-v2" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="staff-editor-heading-v2"><div><span className="eyebrow">{editor.mode === 'create' ? 'Новий акаунт' : 'Редагування профілю'}</span><h3>{editor.displayName || 'Працівник'}</h3><p>{editor.mode === 'create' ? 'Тимчасовий пароль буде показано один раз після створення.' : 'Робочі паролі ніколи не відображаються.'}</p></div><button type="button" onClick={() => setEditor(null)} disabled={saving}><X size={19} /></button></div>
        <div className="staff-editor-grid-v2"><label><span>Логін</span><input value={editor.login} maxLength={40} onChange={(event) => setEditor({ ...editor, login: event.target.value })} disabled={!data?.me.canManage && editor.mode === 'edit'} /></label><label><span>Імʼя</span><input value={editor.displayName} maxLength={120} onChange={(event) => setEditor({ ...editor, displayName: event.target.value })} /></label><label><span>Нікнейм</span><input value={editor.nick} maxLength={80} onChange={(event) => setEditor({ ...editor, nick: event.target.value })} /></label><label><span>Основна роль</span><select value={editor.role} onChange={(event) => setEditor({ ...editor, role: event.target.value, role2: editor.role2 === event.target.value ? '' : editor.role2 })} disabled={!data?.me.canManage}>{roles.filter(([key]) => key !== 'sysadmin').map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label><span>Друга роль</span><select value={editor.role2} onChange={(event) => setEditor({ ...editor, role2: event.target.value })} disabled={!data?.me.canManage}><option value="">Немає</option>{roles.filter(([key]) => key !== 'sysadmin' && key !== editor.role).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label><span>Підпис ролі</span><input value={editor.displayRole} maxLength={80} onChange={(event) => setEditor({ ...editor, displayRole: event.target.value })} disabled={!data?.me.canManage} placeholder="Старший офіціант" /></label><label className="is-wide"><span>Avatar, HTTPS URL</span><input type="url" value={editor.avatar} maxLength={1000} onChange={(event) => setEditor({ ...editor, avatar: event.target.value })} /></label><label><span>Telegram username</span><input value={editor.telegramUsername} maxLength={64} onChange={(event) => setEditor({ ...editor, telegramUsername: event.target.value })} placeholder="username" /></label><label><span>Instagram</span><input value={editor.instagram} maxLength={64} onChange={(event) => setEditor({ ...editor, instagram: event.target.value })} placeholder="username" /></label><label><span>День народження</span><input type="date" value={editor.birthday} onChange={(event) => setEditor({ ...editor, birthday: event.target.value })} /></label><label><span>Днів стажування</span><input type="number" min="0" max="3650" value={editor.traineeDays} onChange={(event) => setEditor({ ...editor, traineeDays: Number(event.target.value) })} disabled={!data?.me.canManage} /></label><label className="staff-notify-field-v2"><input type="checkbox" checked={editor.canNotify} onChange={(event) => setEditor({ ...editor, canNotify: event.target.checked })} disabled={!data?.me.canManage} /><span><MessageCircle size={16} /> Може надсилати сповіщення</span></label><label className="is-wide"><span>Кредо / коротко про себе</span><textarea value={editor.credo} maxLength={1000} onChange={(event) => setEditor({ ...editor, credo: event.target.value })} /></label></div>
        <div className="staff-editor-actions-v2"><span /><button type="button" className="is-save" onClick={() => void saveProfile()} disabled={saving}>{saving ? <RefreshCw size={17} className="is-spinning" /> : <Check size={17} />} {editor.mode === 'create' ? 'Створити акаунт' : 'Зберегти'}</button></div>
      </section></div> : null}

      {credential ? <div className="staff-sheet-backdrop-v2"><section className="staff-credential-sheet-v2" role="dialog" aria-modal="true"><div className="staff-credential-icon-v2"><KeyRound size={30} /></div><span className="eyebrow">Показується один раз</span><h3>{credential.title}</h3><p>Передайте ці дані працівнику безпечним каналом. Після закриття пароль неможливо буде переглянути повторно.</p><div className="staff-credential-values-v2"><label><span>Логін</span><strong>{credential.login}</strong></label><label><span>Тимчасовий пароль</span><strong>{credential.password}</strong></label></div><button type="button" className="is-copy" onClick={() => void copyCredentials()}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Скопійовано' : 'Скопіювати дані'}</button><button type="button" className="is-close" onClick={() => setCredential(null)}>Я передав дані — закрити</button></section></div> : null}
      </> : null}
    </div>
  );
}
