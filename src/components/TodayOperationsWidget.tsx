import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  MapPinned,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
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

  return (
    <section className="today-operations-v4">
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
