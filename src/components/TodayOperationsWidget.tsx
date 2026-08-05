import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock3,
  MapPinned,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
  UsersRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadDutyPlan,
  setPlannedDutyStatus,
  type DutyAssignment,
  type DutyPlanResponse,
} from '../lib/dutyPlannerClient';
import { localIso } from '../lib/operationsClient';
import './today-operations.css';

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '').join('');
}

export function TodayOperationsWidget() {
  const date = useMemo(() => localIso(), []);
  const isTuesday = useMemo(() => new Date(`${date}T12:00:00`).getDay() === 2, [date]);
  const [daily, setDaily] = useState<DutyPlanResponse | null>(null);
  const [handover, setHandover] = useState<DutyPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dailyResult, handoverResult] = await Promise.all([
        loadDutyPlan('daily', date),
        isTuesday ? loadDutyPlan('handover', date) : Promise.resolve(null),
      ]);
      setDaily(dailyResult);
      setHandover(handoverResult);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити обов’язки.');
    } finally {
      setLoading(false);
    }
  }, [date, isTuesday]);

  useEffect(() => { void load(); }, [load]);

  const dailyDefinitions = useMemo(
    () => new Map((daily?.definitions || []).map((item) => [item.key, item.title])),
    [daily],
  );
  const handoverDefinitions = useMemo(
    () => new Map((handover?.definitions || []).map((item) => [item.key, item.title])),
    [handover],
  );
  const zoneDefinitions = useMemo(
    () => new Map((daily?.zones || []).map((item) => [item.key, item.title])),
    [daily],
  );
  const zonesByWaiter = useMemo(() => {
    const result = new Map<string, string[]>();
    if (!daily?.publication) return result;

    daily.zoneAssignments.forEach((assignment) => {
      const title = zoneDefinitions.get(assignment.zone_key) || assignment.zone_key;
      const current = result.get(assignment.assignee_id) || [];
      if (!current.includes(title)) current.push(title);
      result.set(assignment.assignee_id, current);
    });
    return result;
  }, [daily, zoneDefinitions]);

  const dailyAssignments = daily?.publication
    ? daily.assignments.filter((item) => item.assignee_id === daily.me.id)
    : [];
  const handoverAssignments = handover?.publication
    ? handover.assignments.filter((item) => item.assignee_id === handover.me.id)
    : [];
  const personalZones = daily?.publication
    ? daily.zoneAssignments.filter((item) => item.assignee_id === daily.me.id)
    : [];
  const allAssignments = [...dailyAssignments, ...handoverAssignments];
  const doneCount = allAssignments.filter((item) => item.status === 'done').length;

  async function toggleTask(task: DutyAssignment) {
    const next = task.status === 'done' ? 'pending' : 'done';
    setSavingId(task.id);
    setError(null);
    try {
      await setPlannedDutyStatus(task.id, next);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Статус не оновлено.');
    } finally {
      setSavingId(null);
    }
  }

  function taskRow(task: DutyAssignment, title: string, label: string) {
    const busy = savingId === task.id;
    return (
      <button
        type="button"
        key={task.id}
        className={`today-operation-row-v4 status-${task.status}`}
        onClick={() => void toggleTask(task)}
        disabled={busy}
      >
        {busy ? <RefreshCw size={18} className="is-spinning" /> : task.status === 'done' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
        <span><strong>{title}</strong><small>{label}</small></span>
      </button>
    );
  }

  const hasPublishedWork = dailyAssignments.length > 0 || personalZones.length > 0 || handoverAssignments.length > 0;
  const workingWaiters = daily?.workingWaiters || [];

  return (
    <section className="today-operations-v4">
      <section className="today-shift-team-v4" aria-labelledby="today-shift-team-title">
        <header>
          <div>
            <span className="eyebrow">Команда сьогодні</span>
            <h3 id="today-shift-team-title">Офіціанти на зміні</h3>
            <p>Актуальний склад зміни та робочі зони після публікації розподілу.</p>
          </div>
          <span className="today-shift-team-count-v4"><UsersRound size={18} /><strong>{loading ? '…' : workingWaiters.length}</strong></span>
        </header>

        {!loading && workingWaiters.length > 0 && !daily?.publication ? (
          <div className="today-shift-zones-status-v4">
            <MapPinned size={15} />
            <span>Розподіл зон ще не опубліковано.</span>
          </div>
        ) : null}

        {!loading && workingWaiters.length > 0 ? (
          <div className="today-shift-team-grid-v4">
            {workingWaiters.map((waiter) => {
              const zones = zonesByWaiter.get(waiter.id) || [];
              const own = waiter.id === daily?.me.id;
              return (
                <article key={waiter.id} className={own ? 'is-own' : ''}>
                  <span className="today-shift-avatar-v4">
                    {waiter.avatar ? <img src={waiter.avatar} alt="" loading="lazy" /> : <span>{initials(waiter.name)}</span>}
                  </span>
                  <div className="today-shift-person-v4">
                    <strong>
                      <span className="today-shift-name-v4">{waiter.name}</span>
                      {own ? <span className="today-shift-own-badge-v4">Ви</span> : null}
                    </strong>
                    <span><Clock3 size={13} /> Зміна {waiter.shift}</span>
                    {daily?.publication ? (
                      <small className={zones.length ? 'has-zone' : ''}>
                        <MapPinned size={13} />
                        {zones.length ? zones.join(' · ') : 'Зону не призначено'}
                      </small>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {!loading && workingWaiters.length === 0 ? (
          <div className="today-shift-team-empty-v4">
            <UsersRound size={24} />
            <strong>Офіціантів на сьогодні не знайдено</strong>
            <span>Список з’явиться після заповнення графіка.</span>
          </div>
        ) : null}
      </section>

      <header className="today-operations-heading-v4">
        <div>
          <span className="eyebrow">Операційна зміна</span>
          <h3>Мої обов’язки на сьогодні</h3>
          <p>{daily?.me.shift ? `Ваша зміна: ${daily.me.shift}` : 'Робочу зміну на сьогодні не призначено'}</p>
        </div>
        <div className="today-operations-progress-v4"><ClipboardCheck size={20} /><strong>{doneCount}/{allAssignments.length}</strong></div>
      </header>

      {error ? <div className="today-operations-alert-v4"><TriangleAlert size={17} /><span>{error}</span><button type="button" onClick={() => void load()}><RotateCcw size={15} /></button></div> : null}
      {loading ? <div className="today-operations-loading-v4"><RefreshCw size={19} className="is-spinning" /> Завантажуємо розподіл…</div> : null}

      {!loading && hasPublishedWork ? (
        <div className="today-operations-list-v4">
          {dailyAssignments.map((task) => taskRow(task, dailyDefinitions.get(task.duty_key) || task.duty_key, 'Щоденний обов’язок'))}
          {personalZones.length ? (
            <div className="today-zones-v4">
              <header><MapPinned size={18} /><strong>Моя зона роботи</strong></header>
              <div>{personalZones.map((zone) => <span key={zone.id}>{zoneDefinitions.get(zone.zone_key) || zone.zone_key}</span>)}</div>
            </div>
          ) : null}
          {isTuesday && handoverAssignments.length ? (
            <div className="today-tuesday-handover-v4">
              <header><span>Здача зміни · вівторок</span><strong>{handoverAssignments.length}</strong></header>
              {handoverAssignments.map((task) => taskRow(task, handoverDefinitions.get(task.duty_key) || task.duty_key, 'Здача зміни'))}
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && !hasPublishedWork ? (
        <div className="today-operations-empty-v4">
          <ClipboardCheck size={26} />
          <strong>На сьогодні розподіл не опубліковано</strong>
          <span>Обов’язки й зони з’являться тут після того, як адміністратор заповнить таблицю та надішле її в Telegram.</span>
        </div>
      ) : null}
    </section>
  );
}
