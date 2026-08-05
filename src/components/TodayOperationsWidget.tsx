import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CATEGORY_META,
  loadOperations,
  localIso,
  setOperationTask,
  type OperationTask,
  type OperationsResponse,
  type TaskStatus,
} from '../lib/operationsClient';
import './today-operations.css';

export function TodayOperationsWidget() {
  const date = useMemo(() => localIso(), []);
  const [data, setData] = useState<OperationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadOperations(date));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити обов’язки.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { void load(); }, [load]);

  const tasks = data?.tasks || [];
  const doneCount = tasks.filter((task) => task.assignment?.status === 'done').length;
  const isTuesday = new Date(`${date}T12:00:00`).getDay() === 2;
  const handover = isTuesday ? (data?.notes || []).filter((note) => !note.resolved_at) : [];

  async function toggleTask(task: OperationTask) {
    const assignmentId = task.assignment?.id;
    if (!assignmentId) return;
    const next: TaskStatus = task.assignment?.status === 'done' ? 'pending' : 'done';
    setSavingId(assignmentId);
    setError(null);
    try {
      await setOperationTask(assignmentId, next);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Статус не оновлено.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="today-operations-v4">
      <header className="today-operations-heading-v4">
        <div>
          <span className="eyebrow">Операційна зміна</span>
          <h3>Мої обов’язки на сьогодні</h3>
          <p>{data?.me.shift ? `Ваша зміна: ${data.me.shift}` : 'Робочу зміну на сьогодні не призначено'}</p>
        </div>
        <div className="today-operations-progress-v4">
          <ClipboardCheck size={20} />
          <strong>{doneCount}/{tasks.length}</strong>
        </div>
      </header>

      {error ? <div className="today-operations-alert-v4"><TriangleAlert size={17} /><span>{error}</span><button type="button" onClick={() => void load()}><RotateCcw size={15} /></button></div> : null}
      {loading ? <div className="today-operations-loading-v4"><RefreshCw size={19} className="is-spinning" /> Завантажуємо обов’язки…</div> : null}

      {!loading ? (
        <div className="today-operations-list-v4">
          {tasks.map((task) => {
            const status = task.assignment?.status || 'pending';
            const busy = savingId === task.assignment?.id;
            return (
              <button
                type="button"
                key={task.id}
                className={`today-operation-row-v4 status-${status}`}
                onClick={() => void toggleTask(task)}
                disabled={!task.assignment?.id || busy}
              >
                {busy ? <RefreshCw size={18} className="is-spinning" /> : status === 'done' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                <span>
                  <strong>{task.title}</strong>
                  <small>{CATEGORY_META[task.category].label}{task.description ? ` · ${task.description}` : ''}</small>
                </span>
              </button>
            );
          })}
          {tasks.length === 0 ? (
            <div className="today-operations-empty-v4">
              <ClipboardCheck size={26} />
              <strong>На сьогодні обов’язків немає</strong>
              <span>Вони з’являться тут після того, як адміністратор розпише завдання для вашої ролі та зміни.</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && isTuesday && handover.length > 0 ? (
        <div className="today-tuesday-handover-v4">
          <header><span>Здача зміни · вівторок</span><strong>{handover.length} пит.</strong></header>
          {handover.slice(0, 4).map((note) => (
            <article key={note.id} className={`priority-${note.priority}`}>
              <strong>{note.title}</strong>
              <p>{note.body}</p>
              <small>{note.author_name}</small>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
