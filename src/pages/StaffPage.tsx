import {
  AtSign,
  Check,
  Copy,
  Edit3,
  Image as ImageIcon,
  KeyRound,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  UserRoundX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Overlay } from '../components/Overlay';
import { photoFileProblem, resizePhotoFile } from '../lib/photo';
import { peekSecureApi, secureApi } from '../lib/secureApi';
import { StaffBirthdaysTab } from './StaffBirthdaysTab';
import './staff-v3.css';
import { SegThumb } from '../lib/motion';

/* ---------- data ---------- */

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
  canNotify: boolean;
  credo: string | null;
  authLinked: boolean;
  nextShift: StaffShift | null;
  monthShiftCount: number;
}

interface StaffBootstrapResponse {
  ok: true;
  me: { legacyUserId: string; canManage: boolean };
  roles: { key: string; label: string }[];
  users: StaffMember[];
}

interface Editor {
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
  traineeDays: string;
  canNotify: boolean;
  credo: string;
}

interface Credential {
  login: string;
  password: string;
  title: string;
}

type Tab = 'team' | 'birthdays';

/** Groups on the wall, in the order the hall meets them. Plural titles for group headings, singular for a person. */
const GROUPS: { key: string; title: string; one: string; roles: string[] }[] = [
  { key: 'admin', title: 'Адміністрація', one: 'Адміністратор', roles: ['sysadmin', 'admin'] },
  { key: 'kitchen', title: 'Кухня', one: 'Кухня', roles: ['chef', 'cook'] },
  { key: 'waiter', title: 'Офіціанти', one: 'Офіціант', roles: ['waiter'] },
  { key: 'bar', title: 'Бар', one: 'Бар', roles: ['bar', 'barman'] },
  { key: 'sommelier', title: 'Сомельє', one: 'Сомельє', roles: ['sommelier'] },
  { key: 'hostess', title: 'Хостес', one: 'Хостес', roles: ['hostess'] },
  { key: 'runner', title: 'Ранери', one: 'Ранер', roles: ['runner'] },
  { key: 'trainee', title: 'Стажери', one: 'Стажер', roles: ['trainee'] },
  { key: 'staff', title: 'Інші', one: 'Працівник', roles: ['staff'] },
];

const ROLE_LABEL: Record<string, string> = {
  sysadmin: 'Адміністратор', admin: 'Адміністратор', chef: 'Шеф-кухар', cook: 'Кухар', waiter: 'Офіціант',
  bar: 'Бармен', barman: 'Бармен', sommelier: 'Сомельє', hostess: 'Хостес', runner: 'Ранер', trainee: 'Стажер', staff: 'Працівник',
};

const roleLabel = (role: string | null) => (role ? ROLE_LABEL[role] || role : '');
const groupOf = (role: string) => GROUPS.find((group) => group.roles.includes(role)) || GROUPS[GROUPS.length - 1]!;

function personRole(member: StaffMember): string {
  if (member.displayRole) return member.displayRole;
  return [roleLabel(member.role), member.role2 ? roleLabel(member.role2) : null].filter(Boolean).join(' · ');
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
}

function birthdayLabel(value: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`));
}

/** What a schedule code means for a colleague; codes the reader would not know stay out of the profile. */
/** Labels as the schedule API names the codes (tiflis-secure-api WAITER_SHIFT_TYPES). */
const SHIFT_NAMES: Record<string, string> = { 'Р': 'робоча', 'СН': 'сніданки', 'Б': 'бар', 'С': 'сомельє', 'Р/Б': 'робоча + бар', 'СН/Б': 'сніданки + бар', 'С/Р': 'сомельє + робоча', 'С/Б': 'сомельє + бар' };

function shiftLabel(value: StaffShift | null): string | null {
  if (!value) return null;
  const date = new Intl.DateTimeFormat('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${value.date}T12:00:00`));
  const name = SHIFT_NAMES[value.shift];
  return name ? `${date} · ${name}` : date;
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function tenure(value: string | null): string | null {
  if (!value) return null;
  const started = new Date(value).getTime();
  if (!Number.isFinite(started)) return null;
  const days = Math.max(0, Math.floor((Date.now() - started) / 86_400_000));
  if (days < 31) return `${days} ${plural(days, 'день', 'дні', 'днів')}`;
  if (days < 365) { const months = Math.floor(days / 30); return `${months} ${plural(months, 'місяць', 'місяці', 'місяців')}`; }
  const years = Math.floor(days / 365);
  return `${years} ${plural(years, 'рік', 'роки', 'років')}`;
}

function createEditor(member?: StaffMember): Editor {
  return {
    mode: member ? 'edit' : 'create',
    id: member?.id || null,
    login: member?.login || '',
    displayName: member?.displayName || '',
    nick: member?.nick || '',
    avatar: member?.avatar || '',
    // The API reports legacy bartenders as `barman`; the form offers `bar`, so map it or the select shows the wrong role.
    role: member?.role === 'sysadmin' ? 'admin' : member?.role === 'barman' ? 'bar' : member?.role || 'waiter',
    role2: member?.role2 === 'barman' ? 'bar' : member?.role2 || '',
    displayRole: member?.displayRole || '',
    telegramUsername: member?.telegramUsername || '',
    instagram: member?.instagram || '',
    birthday: member?.birthday || '',
    traineeDays: String(member?.traineeDays || 0),
    canNotify: member?.canNotify || false,
    credo: member?.credo || '',
  };
}

/* ---------- page ---------- */

/** Warm the team screen's first request. */
export function prefetch() {
  return secureApi({ action: 'staff_bootstrap' }, 'tiflis-staff-api');
}

export function StaffPage() {
  const [tab, setTab] = useState<Tab>('team');
  const [data, setData] = useState<StaffBootstrapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [archive, setArchive] = useState(false);
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => { setActionError(null); }, [selected]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Paint the last known team at once; the request below refreshes it.
    const known = peekSecureApi<StaffBootstrapResponse>({ action: 'staff_bootstrap' }, 'tiflis-staff-api');
    if (known) setData(known);
    try {
      setData(await secureApi<StaffBootstrapResponse>({ action: 'staff_bootstrap' }, 'tiflis-staff-api'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити команду.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const members = useMemo(() => data?.users ?? [], [data]);
  const meId = data?.me.legacyUserId ?? '';
  const canManage = Boolean(data?.me.canManage);
  const archivedCount = members.filter((member) => member.fired).length;

  const present = useMemo(() => {
    const groups = new Set(members.filter((member) => member.fired === archive).map((member) => groupOf(member.role).key));
    return GROUPS.filter((entry) => groups.has(entry.key));
  }, [archive, members]);

  const needle = query.trim().toLocaleLowerCase('uk-UA');
  const visible = members.filter((member) => {
    if (member.fired !== archive) return false;
    if (group !== 'all' && groupOf(member.role).key !== group) return false;
    if (!needle) return true;
    return [member.displayName, member.nick, canManage ? member.login : '', personRole(member)].join(' ').toLocaleLowerCase('uk-UA').includes(needle);
  });

  const wall = GROUPS.map((entry) => ({
    ...entry,
    people: visible
      .filter((member) => groupOf(member.role).key === entry.key)
      .sort((left, right) => (left.id === meId ? -1 : right.id === meId ? 1 : left.displayName.localeCompare(right.displayName, 'uk'))),
  })).filter((entry) => entry.people.length);

  // Admin actions report inside the open profile (the page behind it is inert), and one runs at a time.
  async function setActive(member: StaffMember, active: boolean) {
    if (acting) return;
    setActing(true);
    setActionError(null);
    try {
      await secureApi({ action: 'staff_set_active', user_id: member.id, active }, 'tiflis-staff-api');
      setSelected(null);
      await load();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Статус не змінено.');
    } finally {
      setActing(false);
    }
  }

  async function resetPassword(member: StaffMember) {
    if (acting) return;
    setActing(true);
    setActionError(null);
    try {
      const response = await secureApi<{ ok: true; temporaryPassword: string }>({ action: 'staff_reset_password', user_id: member.id }, 'tiflis-staff-api');
      setSelected(null);
      setCredential({ login: member.login, password: response.temporaryPassword, title: 'Новий тимчасовий пароль' });
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Пароль не оновлено.');
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="st3">
      <div className="st3-top">
        <div className="st3-seg" role="radiogroup" aria-label="Розділ персоналу">
          <button type="button" role="radio" aria-checked={tab === 'team'} className={`tm-seg${tab === 'team' ? ' is-on' : ''}`} onClick={() => setTab('team')}>{tab === 'team' ? <SegThumb group="staff" /> : null}<span>Команда</span></button>
          <button type="button" role="radio" aria-checked={tab === 'birthdays'} className={`tm-seg${tab === 'birthdays' ? ' is-on' : ''}`} onClick={() => setTab('birthdays')}>{tab === 'birthdays' ? <SegThumb group="staff" /> : null}<span>Дні народження</span></button>
        </div>
        {tab === 'team' && canManage ? (
          <button type="button" className="st3-primary is-compact" onClick={() => setEditor(createEditor())}><Plus size={17} aria-hidden="true" /> Новий працівник</button>
        ) : null}
      </div>

      {tab === 'birthdays' ? <StaffBirthdaysTab /> : (
        <>
          <label className="st3-search">
            <Search size={18} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Імʼя, нік або роль" aria-label="Пошук у команді" />
            {query ? <button type="button" onClick={() => setQuery('')} aria-label="Очистити пошук"><X size={16} /></button> : null}
          </label>

          <div className="st3-chips" role="group" aria-label="Група">
            <button type="button" aria-pressed={group === 'all'} className={group === 'all' ? 'is-on' : ''} onClick={() => setGroup('all')}>Уся команда</button>
            {present.map((entry) => (
              <button key={entry.key} type="button" aria-pressed={group === entry.key} className={group === entry.key ? 'is-on' : ''} onClick={() => setGroup(entry.key)}>{entry.title}</button>
            ))}
            {canManage && (archivedCount || archive) ? (
              <button type="button" aria-pressed={archive} className={`is-archive${archive ? ' is-on' : ''}`} onClick={() => { setArchive((value) => !value); setGroup('all'); }}>
                {archive ? 'Повернутись до команди' : `Архів · ${archivedCount}`}
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="st3-alert" role="alert">
              <span>{error}</span>
              {!data ? <button type="button" onClick={() => void load()}>Спробувати ще раз</button> : <button type="button" onClick={() => setError(null)} aria-label="Закрити"><X size={16} /></button>}
            </div>
          ) : null}

          {loading && !data ? <div className="st3-loading" role="status" aria-label="Завантажуємо команду"><span /><span /><span /><span /></div> : null}

          {data && !wall.length ? <p className="st3-empty">{needle ? `Нікого не знайдено за «${query.trim()}».` : archive ? 'В архіві нікого немає.' : 'Тут поки нікого немає.'}</p> : null}

          {wall.map((entry) => (
            <section key={entry.key} className="st3-group" aria-labelledby={`st3-g-${entry.key}`}>
              <h2 id={`st3-g-${entry.key}`}>{entry.title}<span>{entry.people.length}</span></h2>
              <ul className="st3-wall">
                {entry.people.map((member) => (
                  <li key={member.id}>
                    <button type="button" className={`st3-face${member.id === meId ? ' is-me' : ''}${member.fired ? ' is-archived' : ''}`} onClick={() => setSelected(member)}>
                      <Portrait member={member} />
                      <strong>{member.displayName}</strong>
                      <small>{member.id === meId ? 'Це ти' : member.nick ? `«${member.nick}»` : personRole(member)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {selected ? (
        <Overlay>
          <Profile
            member={selected}
            isMe={selected.id === meId}
            canManage={canManage}
            onClose={() => setSelected(null)}
            onEdit={() => { setEditor(createEditor(selected)); setSelected(null); }}
            onArchive={(active) => void setActive(selected, active)}
            onReset={() => void resetPassword(selected)}
            busy={acting}
            error={actionError}
          />
        </Overlay>
      ) : null}

      {editor ? (
        <Overlay>
          <ProfileEditor
            initial={editor}
            canManage={canManage}
            onClose={() => setEditor(null)}
            onDone={async (created) => {
              setEditor(null);
              if (created) setCredential({ ...created, title: 'Доступ нового працівника' });
              await load();
            }}
          />
        </Overlay>
      ) : null}

      {credential ? <Overlay><CredentialSheet credential={credential} onClose={() => setCredential(null)} /></Overlay> : null}
    </div>
  );
}

/* ---------- pieces ---------- */

function Portrait({ member, size = 'wall' }: { member: Pick<StaffMember, 'avatar' | 'displayName'>; size?: 'wall' | 'hero' | 'edit' }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={`st3-portrait is-${size}${member.avatar && !broken ? '' : ' is-empty'}`} aria-hidden="true">
      {member.avatar && !broken ? <img src={member.avatar} alt="" loading="lazy" onError={() => setBroken(true)} /> : <b>{initials(member.displayName) || '—'}</b>}
    </span>
  );
}

function Profile({ member, isMe, canManage, busy, error, onClose, onEdit, onArchive, onReset }: {
  member: StaffMember; isMe: boolean; canManage: boolean; busy: boolean; error: string | null;
  onClose: () => void; onEdit: () => void; onArchive: (active: boolean) => void; onReset: () => void;
}) {
  // Focus lands on the name, not the close button, so the sheet opens without a ring on ✕.
  const nameRef = useRef<HTMLHeadingElement>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  useLayoutEffect(() => { nameRef.current?.setAttribute('autofocus', ''); }, []);

  const facts = [
    birthdayLabel(member.birthday) ? ['День народження', birthdayLabel(member.birthday)] : null,
    tenure(member.createdAt) ? ['У команді', tenure(member.createdAt)] : null,
    shiftLabel(member.nextShift) ? ['Наступна зміна', shiftLabel(member.nextShift)] : null,
  ].filter((fact): fact is [string, string] => Boolean(fact && fact[1]));

  return (
    <div className="st3-backdrop" onMouseDown={onClose}>
      <section className="st3-sheet" role="dialog" aria-modal="true" aria-labelledby="st3-profile-name" onMouseDown={(event) => event.stopPropagation()}>
        <div className="st3-hero">
          <Portrait member={member} size="hero" />
          <button type="button" className="st3-close" onClick={onClose} aria-label="Закрити"><X size={20} /></button>
        </div>
        <div className="st3-sheet-body">
          <h2 id="st3-profile-name" ref={nameRef} tabIndex={-1}>{member.displayName}</h2>
          <p className="st3-role">{personRole(member)}{member.nick ? ` · «${member.nick}»` : ''}{member.traineeDays > 0 ? ` · стажування ${member.traineeDays} ${plural(member.traineeDays, 'день', 'дні', 'днів')}` : ''}</p>

          {member.credo ? <blockquote className="st3-credo">{member.credo}</blockquote> : null}

          {facts.length ? (
            <dl className="st3-facts">
              {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
          ) : null}

          {member.telegramUsername || member.instagram ? (
            <div className="st3-contacts">
              {member.telegramUsername ? <a href={`https://t.me/${encodeURIComponent(member.telegramUsername)}`} target="_blank" rel="noreferrer"><MessageCircle size={17} aria-hidden="true" /> @{member.telegramUsername}</a> : null}
              {member.instagram ? <a href={`https://instagram.com/${encodeURIComponent(member.instagram)}`} target="_blank" rel="noreferrer"><AtSign size={17} aria-hidden="true" /> {member.instagram}</a> : null}
            </div>
          ) : null}

          {canManage ? (
            <p className="st3-admin-note">Логін <b>{member.login}</b> · {member.authLinked ? 'входить у портал' : 'ще без входу в портал'}{member.fired ? ' · в архіві' : ''}</p>
          ) : null}

          {error ? <p className="st3-sheet-error" role="alert">{error}</p> : null}

          {isMe || canManage ? (
            <div className="st3-actions">
              <button type="button" className="st3-secondary" onClick={onEdit}><Edit3 size={17} aria-hidden="true" /> {isMe ? 'Редагувати мій профіль' : 'Редагувати'}</button>
              {canManage && member.authLinked && !isMe ? (
                confirmReset
                  ? <button type="button" className="st3-danger is-confirm" onClick={onReset} disabled={busy}><KeyRound size={17} aria-hidden="true" /> Так, скинути пароль</button>
                  : <button type="button" className="st3-secondary" onClick={() => setConfirmReset(true)} disabled={busy}><KeyRound size={17} aria-hidden="true" /> Скинути пароль</button>
              ) : null}
              {canManage && member.id !== 'sysadmin' && !isMe ? (
                member.fired ? (
                  <button type="button" className="st3-secondary" onClick={() => onArchive(true)} disabled={busy}><UserCheck size={17} aria-hidden="true" /> Повернути в команду</button>
                ) : confirmArchive ? (
                  <button type="button" className="st3-danger is-confirm" onClick={() => onArchive(false)} disabled={busy}><UserRoundX size={17} aria-hidden="true" /> Так, перенести в архів</button>
                ) : (
                  <button type="button" className="st3-danger" onClick={() => setConfirmArchive(true)} disabled={busy}>Перенести в архів</button>
                )
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ProfileEditor({ initial, canManage, onClose, onDone }: {
  initial: Editor; canManage: boolean; onClose: () => void;
  onDone: (created: { login: string; password: string } | null) => void | Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState<'save' | 'photo' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { nameRef.current?.setAttribute('autofocus', ''); }, []);

  const set = <K extends keyof Editor>(key: K, value: Editor[K]) => setForm((current) => ({ ...current, [key]: value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const creating = form.mode === 'create';
  const roleOptions = GROUPS.flatMap((entry) => entry.roles).filter((role) => role !== 'sysadmin' && role !== 'barman');

  function requestClose() {
    if (busy) return;
    if (dirty && !window.confirm('Закрити без збереження? Зміни пропадуть.')) return;
    onClose();
  }

  async function uploadPhoto(file: File) {
    const fileProblem = photoFileProblem(file);
    if (fileProblem) { setProblem(fileProblem); return; }
    setBusy('photo');
    setProblem(null);
    try {
      const { dataUrl, contentType } = await resizePhotoFile(file, 900);
      const response = await secureApi<{ ok: true; avatar: string }>({ action: 'staff_upload_avatar', ...(creating ? {} : { user_id: form.id }), data: dataUrl, content_type: contentType }, 'tiflis-staff-api');
      set('avatar', response.avatar);
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'Не вдалося завантажити фото.');
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!form.displayName.trim() || (canManage && !form.login.trim())) { setProblem(canManage ? 'Вкажи імʼя і логін.' : 'Вкажи імʼя.'); return; }
    setBusy('save');
    setProblem(null);
    const payload = {
      login: form.login.trim(),
      display_name: form.displayName.trim(),
      nick: form.nick,
      avatar: form.avatar,
      role: form.role,
      role2: form.role2,
      display_role: form.displayRole,
      tg_username: form.telegramUsername,
      instagram: form.instagram,
      birthday: form.birthday,
      trainee_days: Number(form.traineeDays) || 0,
      can_notify: form.canNotify,
      credo: form.credo,
    };
    try {
      if (creating) {
        const response = await secureApi<{ ok: true; login: string; temporaryPassword: string }>({ action: 'staff_create', ...payload }, 'tiflis-staff-api');
        await onDone({ login: response.login, password: response.temporaryPassword });
      } else {
        await secureApi({ action: 'staff_save', user_id: form.id, ...payload }, 'tiflis-staff-api');
        await onDone(null);
      }
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'Профіль не збережено.');
      setBusy(null);
    }
  }

  return (
    <div className="st3-backdrop" onMouseDown={requestClose}>
      <section className="st3-sheet st3-editor" role="dialog" aria-modal="true" aria-labelledby="st3-editor-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="st3-editor-head">
          <h2 id="st3-editor-title">{creating ? 'Новий працівник' : 'Редагувати профіль'}</h2>
          <button type="button" className="st3-close is-flat" onClick={requestClose} disabled={Boolean(busy)} aria-label="Закрити"><X size={20} /></button>
        </div>

        <div className="st3-photo-row">
          <Portrait member={{ avatar: form.avatar || null, displayName: form.displayName }} size="edit" />
          <div>
            <button type="button" className="st3-secondary" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
              {busy === 'photo' ? <RefreshCw size={15} className="st3-spin" aria-hidden="true" /> : <ImageIcon size={16} aria-hidden="true" />}
              {busy === 'photo' ? 'Завантаження…' : form.avatar ? 'Змінити фото' : 'Додати фото'}
            </button>
            {form.avatar ? <button type="button" className="st3-link" onClick={() => set('avatar', '')} disabled={Boolean(busy)}>Прибрати</button> : null}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden tabIndex={-1} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void uploadPhoto(file); }} />
          </div>
        </div>

        <div className="st3-form">
          <label className="is-wide"><span>Імʼя і прізвище</span><input ref={nameRef} value={form.displayName} onChange={(event) => set('displayName', event.target.value)} maxLength={120} /></label>
          <label><span>Нік</span><input value={form.nick} onChange={(event) => set('nick', event.target.value)} maxLength={80} placeholder={creating || canManage ? 'Як кличуть у команді' : 'Як тебе кличуть'} /></label>
          <label><span>День народження</span><input type="date" value={form.birthday} onChange={(event) => set('birthday', event.target.value)} /></label>
          <label><span>Telegram</span><input value={form.telegramUsername} onChange={(event) => set('telegramUsername', event.target.value)} maxLength={64} placeholder="нік без @" autoCapitalize="none" /></label>
          <label><span>Instagram</span><input value={form.instagram} onChange={(event) => set('instagram', event.target.value)} maxLength={64} placeholder="нік без @" autoCapitalize="none" /></label>
          <label className="is-wide"><span>Кредо / коротко про себе</span><textarea value={form.credo} onChange={(event) => set('credo', event.target.value)} maxLength={1000} rows={2} /></label>

          {canManage ? (
            <>
              <p className="st3-form-section is-wide">Доступ і роль</p>
              <label><span>Логін</span><input value={form.login} onChange={(event) => set('login', event.target.value)} maxLength={40} autoCapitalize="none" /></label>
              <label><span>Підпис ролі</span><input value={form.displayRole} onChange={(event) => set('displayRole', event.target.value)} maxLength={80} placeholder="Старший офіціант" /></label>
              <label><span>Основна роль</span><select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value, role2: current.role2 === event.target.value ? '' : current.role2 }))}>{roleOptions.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
              <label><span>Друга роль</span><select value={form.role2} onChange={(event) => set('role2', event.target.value)}><option value="">Немає</option>{roleOptions.filter((role) => role !== form.role).map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
              <label><span>Днів стажування</span><input inputMode="numeric" value={form.traineeDays} onChange={(event) => set('traineeDays', event.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
              <label className="st3-check">
                <input type="checkbox" checked={form.canNotify} onChange={(event) => set('canNotify', event.target.checked)} />
                <span>Може надсилати сповіщення</span>
              </label>
            </>
          ) : null}
        </div>

        {creating ? <p className="st3-hint">Після створення портал покаже тимчасовий пароль — один раз.</p> : null}
        {problem ? <p className="st3-form-error" role="alert">{problem}</p> : null}

        <div className="st3-editor-actions">
          <button type="button" className="st3-primary" onClick={() => void save()} disabled={Boolean(busy)}>
            {busy === 'save' ? <RefreshCw size={16} className="st3-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />} {creating ? 'Створити акаунт' : 'Зберегти'}
          </button>
        </div>
      </section>
    </div>
  );
}

function CredentialSheet({ credential, onClose }: { credential: Credential; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copyRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { copyRef.current?.setAttribute('autofocus', ''); }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Логін: ${credential.login}\nТимчасовий пароль: ${credential.password}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="st3-backdrop">
      <section className="st3-sheet st3-credential" role="dialog" aria-modal="true" aria-labelledby="st3-credential-title">
        <h2 id="st3-credential-title">{credential.title}</h2>
        <p>Передай ці дані працівнику особисто або в приватному повідомленні. Після закриття пароль більше не покажеться.</p>
        <dl className="st3-credential-values">
          <div><dt>Логін</dt><dd>{credential.login}</dd></div>
          <div><dt>Тимчасовий пароль</dt><dd>{credential.password}</dd></div>
        </dl>
        <button ref={copyRef} type="button" className="st3-primary" onClick={() => void copy()}>{copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />} {copied ? 'Скопійовано' : 'Скопіювати дані'}</button>
        <button type="button" className="st3-secondary" onClick={onClose}>Дані передано — закрити</button>
      </section>
    </div>
  );
}
