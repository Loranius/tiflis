import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  RefreshCw,
  RotateCcw,
  Send,
  SkipForward,
  UsersRound,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CATEGORY_META,
  addDays,
  broadcastOperations,
  escapeTelegram,
  formatDate,
  formatMoment,
  initials,
  loadOperations,
  localIso,
  roleLabel,
  setOperationTask,
  type OperationTask,
  type OperationsResponse,
  type TaskStatus,
} from '../lib/operationsClient';
import './operations-pages.css';

export function DutiesPage() {
  const [date, setDate] = useState(() => localIso());
  const [selectedUserId, setSelectedUserId] = useState('');
  const [data, setData] = useState<OperationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadOperations(date, selectedUserId || undefined));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити щоденні обов’язки.');
    } finally {
      setLoading(false);
    }
  }, [date, selectedUserId]);

  useEffect(() => { void load(); }, [load]);

  const subject = data?.subject || data?.me || null;
  const grouped = useMemo(() => {
    const result = new Map<OperationTask['category'], OperationTask[]>();
    (data?.tasks || []).forEach((task) => {
      result.set(task.category, [...(result.get(task.category) || []), task]);
    });
    return [...result.entries()];
  }, [data]);

  const progress = useMemo(() => {
    const tasks = data?.tasks || [];
    const done = tasks.filter((task) => task.assignment?.status === 'done').length;
    return { done, total: tasks.length, percent: tasks.length ? Math.round((done / tasks.length) * 100) : 100 };
  }, [data]);

  const teamOptions = useMemo(() => {
    if (!data) return [];
    const people = [data.me, ...(data.team || [])];
    return [...new Map(people.map((person) => [person.id, person])).values()]
      .sort((left, right) => left.name.localeCompare(right.name, 'uk'));
  }, [data]);

  async function setTask(task: OperationTask, status: TaskStatus) {
    const assignmentId = task.assignment?.id;
    if (!assignmentId) return;
    setSavingId(assignmentId);
    setError(null);
    try {
      await setOperationTask(assignmentId, status);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Статус обов’язку не оновлено.');
    } finally {
      setSavingId(null);
    }
  }

  async function publishWaiterRoster() {
    if (!data?.permissions.canResolveAny) return;
    const waiters = data.team.filter((person) => person.role === 'waiter' || person.role2 === 'waiter');
    if (!waiters.length) {
      setError('На цю дату в графіку немає офіціантів.');
      return;
    }

    setPublishing(true);
    setError(null);
    setNotice(null);
    try {
      const rosters = await Promise.all(waiters.map((person) => loadOperations(date, person.id)));
      const sections = rosters.map((roster) => {
        const person = roster.subject || roster.me;
        const taskLines = roster.tasks.length
          ? roster.tasks.map((task) => `• ${escapeTelegram(task.title)}`).join('\n')
          : '• Обов’язки не призначені';
        return `<b>${escapeTelegram(person.name)} · ${escapeTelegram(person.shift || 'без зміни')}</b>\n${taskLines}`;
      });
      const response = await broadcastOperations(
        `<b>Щоденні обов’язки · ${escapeTelegram(formatDate(date))}</b>\n\n${sections.join('\n\n')}`,
        ['waiter'],
      );
      setNotice(`Надіслано в Telegram: ${response.sent}; без Telegram: ${response.skipped}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося відправити обов’язки в Telegram.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="ops-page-v3">
      <section className="ops-page-hero-v3">
        <div><span className="eyebrow">Робочий день</span><h2>Щоденні обов’язки</h2><p>Персональні завдання за роллю та кодом зміни, прогрес виконання і публікація розподілу офіціантів у Telegram.</p></div>
        <div className="ops-page-mark-v3"><ClipboardCheck size={34} /></div>
      </section>

      <section className="ops-toolbar-v3">
        <div className="ops-date-nav-v3">
          <button type="button" onClick={() => setDate((value) => addDays(value, -1))} aria-label="Попередній день"><ChevronLeft size={18} /></button>
          <label><span>Дата</span><input type="date" value={date} onChange={(event) => { setDate(event.target.value); setSelectedUserId(''); }} /></label>
          <button type="button" onClick={() => setDate((value) => addDays(value, 1))} aria-label="Наступний день"><ChevronRight size={18} /></button>
          <button type="button" className="is-accent" onClick={() => { setDate(localIso()); setSelectedUserId(''); }}>Сьогодні</button>
        </div>
        {data?.permissions.canResolveAny ? (
          <div className="ops-toolbar-actions-v3">
            <label><span>Працівник</span><select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}><option value="">Мої обов’язки</option>{teamOptions.filter((person) => person.id !== data.me.id).map((person) => <option value={person.id} key={person.id}>{person.name} · {person.shift || '—'}</option>)}</select></label>
            <button type="button" className="ops-send-v3" onClick={() => void publishWaiterRoster()} disabled={publishing}>{publishing ? <RefreshCw size={17} className="is-spinning" /> : <Send size={17} />} У Telegram</button>
          </div>
        ) : null}
      </section>

      {error ? <div className="ops-alert-v3 is-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)}><X size={16} /></button></div> : null}
      {notice ? <div className="ops-alert-v3 is-success"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}><X size={16} /></button></div> : null}
      {loading ? <div className="ops-loading-v3"><RefreshCw size={23} className="is-spinning" /><span>Підтягуємо обов’язки…</span></div> : null}

      {!loading && data && subject ? (
        <div className="ops-duty-layout-v3">
          <main className="ops-duty-main-v3">
            <section className="ops-progress-v3">
              <div><span>{subject.name}</span><strong>{progress.done}/{progress.total}</strong></div>
              <p>{formatDate(date, true)} · зміна {subject.shift || 'не призначена'}</p>
              <progress max="100" value={progress.percent} />
              <small>{progress.percent === 100 ? 'Усі обов’язки виконано' : `Виконано на ${progress.percent}%`}</small>
            </section>

            <div className="ops-task-groups-v3">
              {grouped.map(([category, tasks]) => (
                <section key={category}>
                  <header><span>{CATEGORY_META[category].icon}</span><div><strong>{CATEGORY_META[category].label}</strong><small>{tasks.length} завдань</small></div></header>
                  <div>{tasks.map((task) => {
                    const status = task.assignment?.status || 'pending';
                    const busy = savingId === task.assignment?.id;
                    return (
                      <article key={task.id} className={`status-${status}`}>
                        <button type="button" className="ops-task-check-v3" onClick={() => void setTask(task, status === 'done' ? 'pending' : 'done')} disabled={busy}>{busy ? <RefreshCw size={16} className="is-spinning" /> : status === 'done' ? <CheckCircle2 size={19} /> : <span />}</button>
                        <div><strong>{task.title}</strong><p>{task.description || 'Без додаткового опису'}</p>{task.assignment?.completed_by ? <small>Виконав: {task.assignment.completed_by} · {formatMoment(task.assignment.completed_at)}</small> : null}</div>
                        <button type="button" className="ops-task-skip-v3" onClick={() => void setTask(task, status === 'skipped' ? 'pending' : 'skipped')} disabled={busy} aria-label={status === 'skipped' ? 'Повернути завдання' : 'Пропустити завдання'}>{status === 'skipped' ? <RotateCcw size={15} /> : <SkipForward size={15} />}</button>
                      </article>
                    );
                  })}</div>
                </section>
              ))}
              {!grouped.length ? <div className="ops-empty-v3"><CheckCircle2 size={29} /><strong>На цю зміну обов’язків немає</strong><span>Завдання з’являються відповідно до ролі та коду зміни.</span></div> : null}
            </div>
          </main>

          <aside className="ops-team-v3">
            <header><div><span className="eyebrow">Графік дня</span><h3>На зміні · {data.team.length}</h3></div><UsersRound size={21} /></header>
            <div>{data.team.map((person) => <button type="button" key={person.id} className={subject.id === person.id ? 'is-selected' : ''} onClick={() => data.permissions.canResolveAny && setSelectedUserId(person.id)} disabled={!data.permissions.canResolveAny}><span className="ops-avatar-v3">{person.avatar ? <img src={person.avatar} alt="" loading="lazy" /> : initials(person.name)}</span><div><strong>{person.name}</strong><small>{roleLabel(person.role || 'staff')}{person.role2 ? ` · ${roleLabel(person.role2)}` : ''}</small></div><b>{person.shift || '—'}</b></button>)}{!data.team.length ? <p>На цю дату працівників у зміні немає.</p> : null}</div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
