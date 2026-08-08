import {
  CheckCircle2,
  ChevronRight,
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
import { Link } from 'react-router';
import { useKyivDay } from '../hooks/useKyivDay';
import {
  loadDutyPlan,
  setPlannedDutyStatus,
  type DutyAssignment,
  type DutyPlanResponse,
} from '../lib/dutyPlannerClient';
import { secureApi } from '../lib/secureApi';
import { isKyivWeekday } from '../lib/time';
import './today-operations.css';

interface ScheduleStaff {
  id: string;
  name: string;
  role: string;
  role2: string | null;
  avatar: string | null;
}

interface ScheduleEntry {
  user_id: string;
  date: string;
  shift: string | null;
}

interface ScheduleBootstrapResponse {
  ok: true;
  users: ScheduleStaff[];
  entries: ScheduleEntry[];
}

interface WorkingStaff extends ScheduleStaff {
  shift: string;
}

const ROLE_ORDER = [
  'admin',
  'sysadmin',
  'waiter',
  'sommelier',
  'bar',
  'hostess',
  'runner',
  'chef',
  'cook',
  'trainee',
  'staff',
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Адміністратор',
  sysadmin: 'Системний адміністратор',
  waiter: 'Офіціант',
  sommelier: 'Сомельє',
  bar: 'Бармен',
  hostess: 'Хостес',
  runner: 'Ранер',
  chef: 'Шеф-кухар',
  cook: 'Кухар',
  trainee: 'Стажер',
  staff: 'Працівник',
};

function normalizeRole(value: string | null | undefined): string {
  if (value === 'barman' || value === 'bartender') return 'bar';
  return value || 'staff';
}

function staffRoles(staff: ScheduleStaff): string[] {
  return [normalizeRole(staff.role), normalizeRole(staff.role2)]
    .filter((role, index, roles) => Boolean(role) && roles.indexOf(role) === index);
}

function staffRoleTitle(staff: ScheduleStaff): string {
  const roles = staffRoles(staff);
  if (roles.includes('waiter') && roles.includes('bar')) return 'Бармен-офіціант';
  if (roles.includes('waiter') && roles.includes('sommelier')) return 'Сомельє-офіціант';
  if (roles.includes('waiter') && roles.includes('hostess')) return 'Хостес-офіціант';
  if (roles.includes('waiter') && roles.includes('runner')) return 'Ранер-офіціант';
  return roles.map((role) => ROLE_LABELS[role] || role).join(' · ') || 'Працівник';
}

function staffRoleRank(staff: ScheduleStaff): number {
  return Math.min(...staffRoles(staff).map((role) => {
    const index = ROLE_ORDER.indexOf(role);
    return index === -1 ? ROLE_ORDER.length : index;
  }));
}

function isWorkingShift(shift: string | null | undefined): boolean {
  return Boolean(shift && !['Х', 'О'].includes(shift));
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '').join('');
}

export function TodayOperationsWidget({ compact = false }: { compact?: boolean }) {
  const date = useKyivDay();
  const isTuesday = useMemo(() => isKyivWeekday(date, 2), [date]);
  const [daily, setDaily] = useState<DutyPlanResponse | null>(null);
  const [handover, setHandover] = useState<DutyPlanResponse | null>(null);
  const [workingTeam, setWorkingTeam] = useState<WorkingStaff[]>([]);
  const [dutiesLoading, setDutiesLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [dutiesError, setDutiesError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);

  const loadDuties = useCallback(async () => {
    setDutiesLoading(true);
    setDutiesError(null);
    try {
      const [dailyResult, handoverResult] = await Promise.all([
        loadDutyPlan('daily', date),
        isTuesday ? loadDutyPlan('handover', date) : Promise.resolve(null),
      ]);
      setDaily(dailyResult);
      setHandover(handoverResult);
    } catch (reason) {
      setDutiesError(reason instanceof Error ? reason.message : 'Не вдалося завантажити обов’язки.');
    } finally {
      setDutiesLoading(false);
    }
  }, [date, isTuesday]);

  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    setTeamError(null);
    try {
      const response = await secureApi<ScheduleBootstrapResponse>({
        action: 'schedule_bootstrap',
        month: date.slice(0, 7),
      });
      const shifts = new Map(
        response.entries
          .filter((entry) => entry.date === date && isWorkingShift(entry.shift))
          .map((entry) => [entry.user_id, String(entry.shift)]),
      );
      const team = response.users
        .filter((staff) => shifts.has(staff.id))
        .map((staff) => ({ ...staff, shift: shifts.get(staff.id) || '' }))
        .sort((left, right) => {
          return staffRoleRank(left) - staffRoleRank(right)
            || left.name.localeCompare(right.name, 'uk');
        });
      setWorkingTeam(team);
    } catch (reason) {
      setWorkingTeam([]);
      setTeamError(reason instanceof Error ? reason.message : 'Не вдалося завантажити команду.');
    } finally {
      setTeamLoading(false);
    }
  }, [date]);

  useEffect(() => { void loadDuties(); }, [loadDuties]);
  useEffect(() => { void loadTeam(); }, [loadTeam]);

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
  const hasPublishedPlan = Boolean(daily?.publication || (isTuesday && handover?.publication));
  const currentStaff = workingTeam.find((staff) => staff.id === daily?.me.id);
  const currentIsWaiter = currentStaff ? staffRoles(currentStaff).includes('waiter') : true;
  const hasWorkingShift = isWorkingShift(daily?.me.shift);

  async function toggleTask(task: DutyAssignment) {
    const next = task.status === 'done' ? 'pending' : 'done';
    setSavingId(task.id);
    setDutiesError(null);
    try {
      await setPlannedDutyStatus(task.id, next);
      await loadDuties();
    } catch (reason) {
      setDutiesError(reason instanceof Error ? reason.message : 'Статус не оновлено.');
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
        className={`today-operation-row-v5 status-${task.status}`}
        onClick={() => void toggleTask(task)}
        disabled={busy}
      >
        {busy ? <RefreshCw size={18} className="is-spinning" /> : task.status === 'done' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
        <span><strong>{title}</strong><small>{label}</small></span>
      </button>
    );
  }

  if (compact) {
    const zoneLabel = dutiesLoading
      ? 'Завантажуємо розподіл…'
      : dutiesError
        ? 'Не вдалося завантажити зону'
        : !hasWorkingShift
          ? 'Сьогодні у вас немає зміни'
          : !daily?.publication
            ? 'Розподіл ще не опубліковано'
            : !currentIsWaiter
              ? 'Зона для цієї ролі не потрібна'
              : personalZones.length
                ? personalZones.map((zone) => zoneDefinitions.get(zone.zone_key) || zone.zone_key).join(' · ')
                : 'Зону не призначено';
    const firstTask = allAssignments[0];
    const firstTaskTitle = firstTask
      ? (dailyAssignments.some((task) => task.id === firstTask.id)
        ? dailyDefinitions.get(firstTask.duty_key)
        : handoverDefinitions.get(firstTask.duty_key)) || firstTask.duty_key
      : null;
    const dutyLabel = dutiesLoading
      ? 'Завантажуємо обов’язки…'
      : dutiesError
        ? 'Не вдалося завантажити обов’язки'
        : !hasWorkingShift
          ? 'З’являться у ваш робочий день'
          : !hasPublishedPlan
            ? 'Розподіл ще не опубліковано'
            : firstTaskTitle || 'Особистих обов’язків немає';

    return (
      <section className="today-operations-v5 is-dashboard-compact" aria-label="Моя зміна">
        <Link className="today-dashboard-row-v2 today-dashboard-zone-row-v2" to="/duties">
          <span className="today-dashboard-row-icon-v2" aria-hidden="true"><MapPinned size={20} /></span>
          <span className="today-dashboard-row-copy-v2">
            <strong>Моя зона</strong>
            <small>{zoneLabel}</small>
          </span>
          <ChevronRight className="today-dashboard-row-chevron-v2" size={19} aria-hidden="true" />
        </Link>

        <div className="today-dashboard-row-v2 today-dashboard-duty-row-v2">
          {firstTask ? (
            <button
              type="button"
              className={`today-dashboard-task-toggle-v2 status-${firstTask.status}`}
              onClick={() => void toggleTask(firstTask)}
              disabled={savingId === firstTask.id}
              aria-label={firstTask.status === 'done' ? 'Позначити обов’язок невиконаним' : 'Позначити обов’язок виконаним'}
            >
              {savingId === firstTask.id
                ? <RefreshCw size={20} className="is-spinning" />
                : firstTask.status === 'done'
                  ? <CheckCircle2 size={20} />
                  : <Circle size={20} />}
            </button>
          ) : (
            <span className="today-dashboard-row-icon-v2" aria-hidden="true"><ClipboardCheck size={20} /></span>
          )}
          <Link className="today-dashboard-duty-link-v2" to="/duties" aria-label={`Відкрити обов’язки. Виконано ${doneCount} із ${allAssignments.length}`}>
            <span className="today-dashboard-row-copy-v2">
              <strong>Обов’язки</strong>
              <small>{dutyLabel}</small>
            </span>
            <span className="today-dashboard-row-tail-v2" aria-hidden="true">
              <strong>{doneCount}/{allAssignments.length}</strong>
              <ChevronRight size={19} />
            </span>
          </Link>
        </div>

        <Link className="today-dashboard-row-v2 today-dashboard-team-row-v2" to="/schedule">
          <span className="today-dashboard-row-icon-v2" aria-hidden="true"><UsersRound size={20} /></span>
          <span className="today-dashboard-row-copy-v2">
            <strong>Команда сьогодні</strong>
            <small>{teamLoading ? 'Завантажуємо команду…' : teamError ? 'Не вдалося завантажити команду' : `${workingTeam.length} ${workingTeam.length === 1 ? 'працівник' : 'працівників'} у зміні`}</small>
          </span>
          {!teamLoading && workingTeam.length ? (
            <span className="today-dashboard-avatars-v2" role="img" aria-label={`${workingTeam.length} працівників`}>
              {workingTeam.slice(0, 4).map((staff) => (
                <span key={staff.id} className="today-dashboard-avatar-v2">
                  {staff.avatar ? <img src={staff.avatar} alt="" loading="lazy" /> : initials(staff.name)}
                </span>
              ))}
              {workingTeam.length > 4 ? <span className="today-dashboard-avatar-v2 is-more">+{workingTeam.length - 4}</span> : null}
            </span>
          ) : null}
          <ChevronRight className="today-dashboard-row-chevron-v2" size={19} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  return (
    <section className="today-operations-v5">
      <section className="today-personal-work-v5" aria-labelledby="today-personal-work-title">
        <header className="today-personal-heading-v5">
          <div>
            <span className="eyebrow">Моя зміна</span>
            <h2 id="today-personal-work-title">Моя зона й обов’язки</h2>
            <p>{daily?.me.shift ? `Зміна ${daily.me.shift}` : 'Робочу зміну на сьогодні не призначено'}</p>
          </div>
          <div className="today-operations-progress-v5" aria-label={`Виконано ${doneCount} із ${allAssignments.length}`}>
            <ClipboardCheck size={20} />
            <strong>{doneCount}/{allAssignments.length}</strong>
          </div>
        </header>

        {dutiesError ? (
          <div className="today-operations-alert-v5">
            <TriangleAlert size={17} />
            <span>{dutiesError}</span>
            <button type="button" onClick={() => void loadDuties()} aria-label="Повторити завантаження">
              <RotateCcw size={15} />
            </button>
          </div>
        ) : null}

        {dutiesLoading ? (
          <div className="today-operations-loading-v5">
            <RefreshCw size={19} className="is-spinning" />
            Завантажуємо вашу зміну…
          </div>
        ) : null}

        {!dutiesLoading && !hasWorkingShift ? (
          <div className="today-operations-empty-v5">
            <ClipboardCheck size={26} />
            <strong>Сьогодні у вас немає робочої зміни</strong>
            <span>Зона й обов’язки з’являться тут у ваш робочий день.</span>
          </div>
        ) : null}

        {!dutiesLoading && hasWorkingShift && hasPublishedPlan ? (
          <div className="today-personal-list-v5">
            {currentIsWaiter ? (
              <div className={`today-zones-v5${personalZones.length ? '' : ' is-empty'}`}>
                <header><MapPinned size={18} /><strong>Моя зона</strong></header>
                <div>
                  {personalZones.length
                    ? personalZones.map((zone) => (
                      <span key={zone.id}>{zoneDefinitions.get(zone.zone_key) || zone.zone_key}</span>
                    ))
                    : <span className="is-empty">Зону не призначено</span>}
                </div>
              </div>
            ) : null}

            {dailyAssignments.map((task) => taskRow(
              task,
              dailyDefinitions.get(task.duty_key) || task.duty_key,
              'Щоденний обов’язок',
            ))}

            {isTuesday && handoverAssignments.length ? (
              <div className="today-tuesday-handover-v5">
                <header><span>Здача зміни</span><strong>{handoverAssignments.length}</strong></header>
                {handoverAssignments.map((task) => taskRow(
                  task,
                  handoverDefinitions.get(task.duty_key) || task.duty_key,
                  'Здача зміни',
                ))}
              </div>
            ) : null}

            {allAssignments.length === 0 ? (
              <div className="today-no-personal-duties-v5">Особистих обов’язків на сьогодні не призначено.</div>
            ) : null}
          </div>
        ) : null}

        {!dutiesLoading && hasWorkingShift && !hasPublishedPlan ? (
          <div className="today-operations-empty-v5">
            <ClipboardCheck size={26} />
            <strong>Розподіл ще не опубліковано</strong>
            <span>Після публікації тут з’являться ваша зона та особисті обов’язки.</span>
          </div>
        ) : null}
      </section>

      <section className="today-shift-team-v5" aria-labelledby="today-shift-team-title">
        <header>
          <div>
            <span className="eyebrow">Команда сьогодні</span>
            <h2 id="today-shift-team-title">Хто сьогодні працює</h2>
            <p>Уся команда за графіком на поточний день.</p>
          </div>
          <span className="today-shift-team-count-v5">
            <UsersRound size={18} />
            <strong>{teamLoading ? '…' : workingTeam.length}</strong>
          </span>
        </header>

        {teamError ? (
          <div className="today-operations-alert-v5">
            <TriangleAlert size={17} />
            <span>{teamError}</span>
            <button type="button" onClick={() => void loadTeam()} aria-label="Повторити завантаження">
              <RotateCcw size={15} />
            </button>
          </div>
        ) : null}

        {teamLoading ? (
          <div className="today-team-loading-v5">
            <RefreshCw size={19} className="is-spinning" />
            Завантажуємо команду…
          </div>
        ) : null}

        {!teamLoading && workingTeam.length > 0 ? (
          <div className="today-shift-team-grid-v5">
            {workingTeam.map((staff) => {
              const zones = zonesByWaiter.get(staff.id) || [];
              const own = staff.id === daily?.me.id;
              const waiter = staffRoles(staff).includes('waiter');
              return (
                <article key={staff.id} className={own ? 'is-own' : ''}>
                  <span className="today-shift-avatar-v5">
                    {staff.avatar ? <img src={staff.avatar} alt="" loading="lazy" /> : <span>{initials(staff.name)}</span>}
                  </span>
                  <div className="today-shift-person-v5">
                    <strong>
                      <span className="today-shift-name-v5">{staff.name}</span>
                      {own ? <span className="today-shift-own-badge-v5">Ви</span> : null}
                    </strong>
                    <span>{staffRoleTitle(staff)}</span>
                    <small><Clock3 size={13} /> Зміна {staff.shift}</small>
                    {waiter && daily?.publication ? (
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

        {!teamLoading && workingTeam.length === 0 ? (
          <div className="today-shift-team-empty-v5">
            <UsersRound size={24} />
            <strong>Працівників на сьогодні не знайдено</strong>
            <span>Список з’явиться після заповнення графіка.</span>
          </div>
        ) : null}
      </section>
    </section>
  );
}
