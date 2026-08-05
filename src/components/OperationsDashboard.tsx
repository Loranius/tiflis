import {
  BellRing,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  MessageSquarePlus,
  RefreshCw,
  RotateCcw,
  Send,
  SkipForward,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { secureApi } from '../lib/secureApi';
import './operations.css';

type TaskStatus = 'pending' | 'done' | 'skipped';
type Priority = 'low' | 'medium' | 'high' | 'critical';

interface TaskAssignment {
  id: number;
  template_id: number;
  work_date: string;
  assignee_id: string;
  status: TaskStatus;
  note: string | null;
  completed_by: string | null;
  completed_at: string | null;
}

interface OperationTask {
  id: number;
  title: string;
  description: string | null;
  category: 'opening' | 'service' | 'closing' | 'handover';
  role_scope: string[] | null;
  shift_codes: string[] | null;
  sort_order: number;
  active: boolean;
  assignment: TaskAssignment | null;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  role2: string | null;
  avatar: string | null;
  shift: string;
}

interface HandoverNote {
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

interface OperationNotification {
  id: number;
  title: string;
  body: string | null;
  priority: Priority | null;
  author: string;
  roles: string | null;
  expires_at: string | null;
  created_at: string | null;
}

interface OperationsResponse {
  ok: true;
  date: string;
  me: { id: string; name: string; roles: string[]; shift: string | null };
  permissions: { canManageTemplates: boolean; canResolveAny: boolean };
  tasks: OperationTask[];
  team: TeamMember[];
  notes: HandoverNote[];
  notifications: OperationNotification[];
}

interface NoteEditor {
  title: string;
  body: string;
  priority: Priority;
  roleScope: string[];
}

const CATEGORY_META = {
  opening: { label: 'Перед відкриттям', icon: '☀️' },
  service: { label: 'Під час сервісу', icon: '🍽️' },
  closing: { label: 'Закриття', icon: '🌙' },
  handover: { label: 'Передача зміни', icon: '↗' },
};

const ROLE_OPTIONS = [
  ['admin', 'Адміністрація'],
  ['chef', 'Шеф'],
  ['cook', 'Кухня'],
  ['waiter', 'Офіціанти'],
  ['bar', 'Бар'],
  ['hostess', 'Хостес'],
  ['runner', 'Ранери'],
  ['sommelier', 'Сомельє'],
] as const;

function localIso(date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function addDays(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localIso(date);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(`${value}T12:00:00`));
}

function formatMoment(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '').join('');
}

function roleLabel(value: string): string {
  const labels: Record<string, string> = {
    admin: 'Адміністрація', sysadmin: 'Сисадмін', chef: 'Шеф', cook: 'Кухня',
    waiter: 'Офіціант', bar: 'Бар', hostess: 'Хостес', runner: 'Ранер', sommelier: 'Сомельє',
  };
  return labels[value] || value;
}

function initialNote(): NoteEditor {
  return { title: '', body: '', priority: 'medium', roleScope: [] };
}

export function OperationsDashboard() {
  const [date, setDate] = useState(() => localIso());
  const [data, setData] = useState<OperationsResponse | null>(null);
  const [noteEditor, setNoteEditor] = useState<NoteEditor | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await secureApi<OperationsResponse>(
        { action: 'operations_bootstrap', date },
        'tiflis-operations-api',
      );
      setData(response);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити робочу зміну.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { void load(); }, [load]);

  const progress = useMemo(() => {
    const tasks = data?.tasks || [];
    const done = tasks.filter((task) => task.assignment?.status === 'done').length;
    return {
      done,
      total: tasks.length,
      percent: tasks.length ? Math.round((done / tasks.length) * 100) : 100,
    };
  }, [data]);

  const grouped = useMemo(() => {
    const result = new Map<OperationTask['category'], OperationTask[]>();
    (data?.tasks || []).forEach((task) => {
      result.set(task.category, [...(result.get(task.category) || []), task]);
    });
    return [...result.entries()];
  }, [data]);

  const activeNotes = useMemo(
    () => (data?.notes || []).filter((note) => !note.resolved_at),
    [data],
  );

  async function setTask(task: OperationTask, status: TaskStatus) {
    const assignmentId = task.assignment?.id;
    if (!assignmentId) return;
    setSavingId(assignmentId);
    setError(null);
    try {
      await secureApi<{ ok: true }>({
        action: 'operations_set_task',
        assignment_id: assignmentId,
        status,
      }, 'tiflis-operations-api');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Статус завдання не оновлено.');
    } finally {
      setSavingId(null);
    }
  }

  async function publishNote() {
    if (!noteEditor || !noteEditor.title.trim() || !noteEditor.body.trim()) {
      setError('Вкажіть заголовок і текст передачі зміни.');
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      await secureApi<{ ok: true }>({
        action: 'operations_add_note',
        date,
        title: noteEditor.title,
        body: noteEditor.body,
        priority: noteEditor.priority,
        role_scope: noteEditor.roleScope,
      }, 'tiflis-operations-api');
      setNoteEditor(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Нотатку не опубліковано.');
    } finally {
      setPublishing(false);
    }
  }

  async function resolveNote(note: HandoverNote, resolved: boolean) {
    setSavingId(note.id);
    setError(null);
    try {
      await secureApi<{ ok: true }>({
        action: 'operations_resolve_note',
        id: note.id,
        resolved,
      }, 'tiflis-operations-api');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Нотатку не оновлено.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="operations-dashboard-v2">
      <header className="operations-heading-v2">
        <div>
          <span className="eyebrow">Операційна зміна</span>
          <h3>{formatDate(date)}</h3>
          <p>{data?.me.shift ? `Ваша зміна: ${data.me.shift}` : 'На цю дату ваша зміна не призначена'}</p>
        </div>
        <div className="operations-date-actions-v2">
          <button type="button" onClick={() => setDate((value) => addDays(value, -1))} aria-label="Попередній день"><ChevronLeft size={18} /></button>
          <button type="button" onClick={() => setDate(localIso())}>Сьогодні</button>
          <button type="button" onClick={() => setDate((value) => addDays(value, 1))} aria-label="Наступний день"><ChevronRight size={18} /></button>
        </div>
      </header>

      {error ? <div className="operations-alert-v2" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)}><X size={15} /></button></div> : null}
      {loading ? <div className="operations-loading-v2"><RefreshCw size={22} className="is-spinning" /><span>Готуємо робочу зміну…</span></div> : null}

      {!loading && data ? (
        <div className="operations-layout-v2">
          <div className="operations-main-v2">
            <section className="operations-progress-card-v2">
              <div><span><ClipboardCheck size={18} /> Мої обов’язки</span><strong>{progress.done}/{progress.total}</strong></div>
              <progress max="100" value={progress.percent} />
              <small>{progress.percent === 100 ? 'Усі обов’язки виконано' : `Готово на ${progress.percent}%`}</small>
            </section>

            <div className="operations-task-groups-v2">
              {grouped.map(([category, tasks]) => (
                <section key={category}>
                  <header><span>{CATEGORY_META[category].icon}</span><div><strong>{CATEGORY_META[category].label}</strong><small>{tasks.length} завд.</small></div></header>
                  <div>{tasks.map((task) => {
                    const status = task.assignment?.status || 'pending';
                    const busy = savingId === task.assignment?.id;
                    return <article key={task.id} className={`status-${status}`}><button type="button" className="operations-task-toggle-v2" onClick={() => void setTask(task, status === 'done' ? 'pending' : 'done')} disabled={busy}>{busy ? <RefreshCw size={16} className="is-spinning" /> : status === 'done' ? <CheckCircle2 size={18} /> : <span />}</button><div><strong>{task.title}</strong><p>{task.description || 'Без додаткового опису'}</p>{task.assignment?.completed_by ? <small>Виконав: {task.assignment.completed_by} · {formatMoment(task.assignment.completed_at)}</small> : null}</div><button type="button" className="operations-skip-v2" onClick={() => void setTask(task, status === 'skipped' ? 'pending' : 'skipped')} disabled={busy} title={status === 'skipped' ? 'Повернути' : 'Пропустити'}>{status === 'skipped' ? <RotateCcw size={15} /> : <SkipForward size={15} />}</button></article>;
                  })}</div>
                </section>
              ))}
              {grouped.length === 0 ? <div className="operations-empty-v2"><CheckCircle2 size={28} /><strong>На цю дату обов’язків немає</strong><span>Шаблони можуть залежати від ролі або коду зміни.</span></div> : null}
            </div>
          </div>

          <aside className="operations-side-v2">
            <section className="operations-team-v2">
              <header><div><span className="eyebrow">На зміні</span><h4>Команда · {data.team.length}</h4></div><UsersRound size={20} /></header>
              <div>{data.team.map((member) => <article key={member.id}><span className="operations-avatar-v2">{member.avatar ? <img src={member.avatar} alt="" loading="lazy" /> : initials(member.name)}</span><div><strong>{member.name}</strong><small>{roleLabel(member.role)}{member.role2 ? ` · ${roleLabel(member.role2)}` : ''}</small></div><b>{member.shift}</b></article>)}{data.team.length === 0 ? <p>На цю дату робочих змін немає.</p> : null}</div>
            </section>

            <section className="operations-handover-v2">
              <header><div><span className="eyebrow">Передача зміни</span><h4>Незавершені питання</h4></div><button type="button" onClick={() => setNoteEditor(initialNote())}><MessageSquarePlus size={17} /> Додати</button></header>
              <div>{activeNotes.slice(0, 8).map((note) => <article key={note.id} className={`priority-${note.priority} ${note.pinned ? 'is-pinned' : ''}`}><div><strong>{note.title}</strong><span>{note.author_name} · {formatMoment(note.created_at)}</span></div><p>{note.body}</p><footer>{note.role_scope?.length ? <span>{note.role_scope.map(roleLabel).join(' · ')}</span> : <span>Для всієї команди</span>}<button type="button" onClick={() => void resolveNote(note, true)} disabled={savingId === note.id}><Check size={14} /> Закрити</button></footer></article>)}{activeNotes.length === 0 ? <div className="operations-empty-v2 is-small"><Sparkles size={24} /><strong>Передача зміни чиста</strong><span>Невирішених питань немає.</span></div> : null}</div>
            </section>

            {data.notifications.length ? <section className="operations-notices-v2"><header><BellRing size={18} /><strong>Актуальні повідомлення</strong></header>{data.notifications.slice(0, 3).map((item) => <article key={item.id} className={`priority-${item.priority || 'medium'}`}><strong>{item.title}</strong><p>{item.body || 'Без додаткового тексту'}</p><small>{item.author} · {formatMoment(item.created_at)}</small></article>)}</section> : null}
          </aside>
        </div>
      ) : null}

      {noteEditor ? <div className="operations-modal-backdrop-v2" onMouseDown={() => !publishing && setNoteEditor(null)}><section className="operations-note-modal-v2" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">Нова передача зміни</span><h3>Залишити важливе наступній команді</h3></div><button type="button" onClick={() => setNoteEditor(null)} disabled={publishing}><X size={18} /></button></header><label><span>Заголовок</span><input value={noteEditor.title} maxLength={180} onChange={(event) => setNoteEditor({ ...noteEditor, title: event.target.value })} /></label><label><span>Що потрібно передати</span><textarea value={noteEditor.body} maxLength={3000} onChange={(event) => setNoteEditor({ ...noteEditor, body: event.target.value })} /></label><div className="operations-note-row-v2"><label><span>Пріоритет</span><select value={noteEditor.priority} onChange={(event) => setNoteEditor({ ...noteEditor, priority: event.target.value as Priority })}><option value="low">Низький</option><option value="medium">Звичайний</option><option value="high">Важливий</option><option value="critical">Критичний</option></select></label></div><div className="operations-role-scope-v2"><strong>Кому показати</strong><span>Порожній вибір — усій команді.</span><div>{ROLE_OPTIONS.map(([key, label]) => { const active = noteEditor.roleScope.includes(key); return <button type="button" key={key} className={active ? 'is-active' : ''} onClick={() => setNoteEditor({ ...noteEditor, roleScope: active ? noteEditor.roleScope.filter((role) => role !== key) : [...noteEditor.roleScope, key] })}>{active ? <Check size={12} /> : null}{label}</button>; })}</div></div><button type="button" className="operations-publish-v2" onClick={() => void publishNote()} disabled={publishing}>{publishing ? <RefreshCw size={17} className="is-spinning" /> : <Send size={17} />} Опублікувати</button></section></div> : null}
    </section>
  );
}
