import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eraser,
  RefreshCw,
  Save,
  Send,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadDutyPlan,
  publishDutyPlan,
  saveDutyPlan,
  type DutyPlanResponse,
  type DutyPlanType,
  type WorkingWaiter,
} from '../lib/dutyPlannerClient';
import { addDays, formatDate, formatMoment, initials, localIso } from '../lib/operationsClient';
import './duty-planner.css';

interface DutyPlannerPageProps {
  planType: DutyPlanType;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

type DutySelections = Record<string, string>;
type ZoneSelections = Record<string, string[]>;

function tuesdayForWeek(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  const day = date.getDay();
  date.setDate(date.getDate() + (2 - day));
  return localIso(date);
}

function initialDate(type: DutyPlanType): string {
  const today = localIso();
  return type === 'handover' ? tuesdayForWeek(today) : today;
}

function workerLabel(worker: WorkingWaiter): string {
  return `${worker.name} · ${worker.shift}`;
}

export function DutyPlannerPage({
  planType,
  eyebrow,
  title,
  description,
  icon: Icon,
}: DutyPlannerPageProps) {
  const [date, setDate] = useState(() => initialDate(planType));
  const [data, setData] = useState<DutyPlanResponse | null>(null);
  const [duties, setDuties] = useState<DutySelections>({});
  const [zones, setZones] = useState<ZoneSelections>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hydrate = useCallback((response: DutyPlanResponse) => {
    const dutyMap: DutySelections = {};
    response.assignments.forEach((item) => { dutyMap[item.duty_key] = item.assignee_id; });
    const zoneMap: ZoneSelections = {};
    response.zones.forEach((zone) => { zoneMap[zone.key] = ['', '', '']; });
    response.zoneAssignments.forEach((item) => {
      const current = zoneMap[item.zone_key] || ['', '', ''];
      current[item.slot - 1] = item.assignee_id;
      zoneMap[item.zone_key] = current;
    });
    setDuties(dutyMap);
    setZones(zoneMap);
    setDirty(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await loadDutyPlan(planType, date);
      setData(response);
      hydrate(response);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити розподіл.');
    } finally {
      setLoading(false);
    }
  }, [date, hydrate, planType]);

  useEffect(() => { void load(); }, [load]);

  const workerMap = useMemo(
    () => new Map((data?.workingWaiters || []).map((worker) => [worker.id, worker])),
    [data],
  );
  const savedAssigneeMap = useMemo(
    () => new Map((data?.assignments || []).map((item) => [item.duty_key, item])),
    [data],
  );
  const savedZoneMap = useMemo(() => {
    const map = new Map<string, Map<number, DutyPlanResponse['zoneAssignments'][number]>>();
    (data?.zoneAssignments || []).forEach((item) => {
      const slots = map.get(item.zone_key) || new Map();
      slots.set(item.slot, item);
      map.set(item.zone_key, slots);
    });
    return map;
  }, [data]);

  const assignedDutyCount = Object.values(duties).filter(Boolean).length;
  const assignedZoneCount = Object.values(zones).flat().filter(Boolean).length;
  const hasPlan = assignedDutyCount + assignedZoneCount > 0;

  function requestDate(next: string) {
    const normalized = planType === 'handover' ? tuesdayForWeek(next) : next;
    if (normalized === date) return;
    if (dirty && !window.confirm('Є незбережені зміни. Перейти на іншу дату без збереження?')) return;
    setDate(normalized);
    setNotice(null);
    setError(null);
  }

  function setDuty(dutyKey: string, assigneeId: string) {
    setDuties((current) => ({ ...current, [dutyKey]: assigneeId }));
    setDirty(true);
    setNotice(null);
  }

  function setZone(zoneKey: string, slot: number, assigneeId: string) {
    setZones((current) => {
      const next = [...(current[zoneKey] || ['', '', ''])];
      next[slot] = assigneeId;
      return { ...current, [zoneKey]: next };
    });
    setDirty(true);
    setNotice(null);
  }

  function clearPlan() {
    if (!window.confirm('Очистити всі призначення на вибрану дату?')) return;
    setDuties({});
    setZones(Object.fromEntries((data?.zones || []).map((zone) => [zone.key, ['', '', '']])));
    setDirty(true);
    setNotice(null);
  }

  async function save() {
    if (!data?.permissions.canManage) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveDutyPlan(planType, date, {
        assignments: Object.entries(duties)
          .filter(([, assigneeId]) => Boolean(assigneeId))
          .map(([dutyKey, assigneeId]) => ({ duty_key: dutyKey, assignee_id: assigneeId })),
        zones: planType === 'daily'
          ? Object.entries(zones).flatMap(([zoneKey, assignees]) => assignees
            .map((assigneeId, index) => ({ zone_key: zoneKey, slot: index + 1, assignee_id: assigneeId }))
            .filter((item) => Boolean(item.assignee_id)))
          : [],
      });
      setNotice('Розподіл збережено. Для появи на головній його потрібно надіслати в Telegram.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Розподіл не збережено.');
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!data?.permissions.canManage || dirty) return;
    setPublishing(true);
    setError(null);
    setNotice(null);
    try {
      const response = await publishDutyPlan(planType, date);
      setNotice(`Надіслано в Telegram: ${response.sent}; без прив’язаного Telegram: ${response.skipped}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося надіслати розподіл у Telegram.');
    } finally {
      setPublishing(false);
    }
  }

  function staleDutyOption(dutyKey: string, value: string) {
    if (!value || workerMap.has(value)) return null;
    const saved = savedAssigneeMap.get(dutyKey);
    return <option value={value} disabled>{saved?.assignee_name || value} · не працює цього дня</option>;
  }

  function staleZoneOption(zoneKey: string, slot: number, value: string) {
    if (!value || workerMap.has(value)) return null;
    const saved = savedZoneMap.get(zoneKey)?.get(slot + 1);
    return <option value={value} disabled>{saved?.assignee_name || value} · не працює цього дня</option>;
  }

  const dateStep = planType === 'handover' ? 7 : 1;
  const todayButtonLabel = planType === 'handover' ? 'Цей вівторок' : 'Сьогодні';

  return (
    <div className="duty-planner-page-v1">
      <section className={`duty-planner-hero-v1 is-${planType}`}>
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="duty-planner-mark-v1"><Icon size={34} /></div>
      </section>

      <section className="duty-planner-toolbar-v1">
        <div className="duty-planner-date-v1">
          <button type="button" onClick={() => requestDate(addDays(date, -dateStep))} aria-label="Попередня дата"><ChevronLeft size={18} /></button>
          <label><span>{planType === 'handover' ? 'Вівторок' : 'Дата'}</span><input type="date" value={date} onChange={(event) => requestDate(event.target.value)} /></label>
          <button type="button" onClick={() => requestDate(addDays(date, dateStep))} aria-label="Наступна дата"><ChevronRight size={18} /></button>
          <button type="button" className="is-accent" onClick={() => requestDate(initialDate(planType))}>{todayButtonLabel}</button>
        </div>

        {data?.permissions.canManage ? (
          <div className="duty-planner-actions-v1">
            <button type="button" onClick={clearPlan} disabled={saving || publishing}><Eraser size={17} /> Очистити</button>
            <button type="button" className="is-save" onClick={() => void save()} disabled={!dirty || saving || publishing}>{saving ? <RefreshCw size={17} className="is-spinning" /> : <Save size={17} />} Зберегти</button>
            <button type="button" className="is-send" onClick={() => void publish()} disabled={dirty || !hasPlan || saving || publishing}>{publishing ? <RefreshCw size={17} className="is-spinning" /> : <Send size={17} />} У Telegram</button>
          </div>
        ) : null}
      </section>

      {error ? <div className="duty-planner-alert-v1 is-error" role="alert"><CircleAlert size={17} /><span>{error}</span><button type="button" onClick={() => setError(null)}><X size={16} /></button></div> : null}
      {notice ? <div className="duty-planner-alert-v1 is-success"><Check size={17} /><span>{notice}</span><button type="button" onClick={() => setNotice(null)}><X size={16} /></button></div> : null}
      {dirty ? <div className="duty-planner-unsaved-v1">Є незбережені зміни. Telegram-відправка стане доступною після збереження.</div> : null}
      {loading ? <div className="duty-planner-loading-v1"><RefreshCw size={23} className="is-spinning" /><span>Підтягуємо графік і призначення…</span></div> : null}

      {!loading && data ? (
        <div className="duty-planner-layout-v1">
          <main className="duty-planner-main-v1">
            <section className="duty-planner-card-v1">
              <header className="duty-planner-card-heading-v1">
                <div><span className="eyebrow">{formatDate(date, true)}</span><h3>Таблиця обов’язків</h3></div>
                <div className="duty-planner-count-v1"><strong>{assignedDutyCount}</strong><span>призначено</span></div>
              </header>

              <div className="duty-planner-table-wrap-v1">
                <table className="duty-planner-table-v1">
                  <thead><tr><th>Обов’язок</th><th>Відповідальний офіціант</th></tr></thead>
                  <tbody>
                    {data.definitions.map((duty) => {
                      const value = duties[duty.key] || '';
                      const assignment = savedAssigneeMap.get(duty.key);
                      return (
                        <tr key={duty.key} className={value && !workerMap.has(value) ? 'has-stale-assignment' : ''}>
                          <td>{duty.title}</td>
                          <td>
                            {data.permissions.canManage ? (
                              <select value={value} onChange={(event) => setDuty(duty.key, event.target.value)}>
                                <option value="">— Не призначено —</option>
                                {staleDutyOption(duty.key, value)}
                                {data.workingWaiters.map((worker) => <option value={worker.id} key={worker.id}>{workerLabel(worker)}</option>)}
                              </select>
                            ) : value ? (
                              <span className={`duty-planner-person-v1 ${assignment?.assignee_working === false ? 'is-stale' : ''}`}>{assignment?.assignee_name || value}<small>{assignment?.assignee_shift || 'не в графіку'}</small></span>
                            ) : <span className="duty-planner-empty-v1">Не призначено</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {planType === 'daily' ? (
              <section className="duty-planner-card-v1 is-zones">
                <header className="duty-planner-card-heading-v1">
                  <div><span className="eyebrow">Розподіл залів</span><h3>Зони роботи</h3></div>
                  <div className="duty-planner-count-v1"><strong>{assignedZoneCount}</strong><span>місць зайнято</span></div>
                </header>
                <p className="duty-planner-zone-note-v1">На одну зону можна призначити до трьох офіціантів. Незаповнена зона вважається вільною й не надсилається в Telegram.</p>

                <div className="duty-planner-table-wrap-v1">
                  <table className="duty-planner-table-v1 is-zones">
                    <thead><tr><th>Зона</th><th>Офіціанти · до 3</th></tr></thead>
                    <tbody>
                      {data.zones.map((zone) => {
                        const values = zones[zone.key] || ['', '', ''];
                        const savedSlots = savedZoneMap.get(zone.key);
                        return (
                          <tr key={zone.key}>
                            <td>{zone.title}</td>
                            <td>
                              {data.permissions.canManage ? (
                                <div className="duty-planner-zone-selects-v1">
                                  {[0, 1, 2].map((slot) => {
                                    const value = values[slot] || '';
                                    const usedByOtherSlots = new Set(values.filter((item, index) => Boolean(item) && index !== slot));
                                    return (
                                      <select value={value} onChange={(event) => setZone(zone.key, slot, event.target.value)} key={slot}>
                                        <option value="">{slot === 0 ? '— Зона вільна —' : `+ Офіціант ${slot + 1}`}</option>
                                        {staleZoneOption(zone.key, slot, value)}
                                        {data.workingWaiters.filter((worker) => !usedByOtherSlots.has(worker.id)).map((worker) => <option value={worker.id} key={worker.id}>{workerLabel(worker)}</option>)}
                                      </select>
                                    );
                                  })}
                                </div>
                              ) : values.some(Boolean) ? (
                                <div className="duty-planner-zone-people-v1">{values.filter(Boolean).map((id, index) => {
                                  const worker = workerMap.get(id);
                                  const saved = savedSlots?.get(index + 1);
                                  return <span className={`duty-planner-person-v1 ${!worker ? 'is-stale' : ''}`} key={`${id}-${index}`}>{worker?.name || saved?.assignee_name || id}<small>{worker?.shift || saved?.assignee_shift || 'не в графіку'}</small></span>;
                                })}</div>
                              ) : <span className="duty-planner-free-zone-v1">Вільна зона</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="duty-planner-rule-v1">Офіціанти можуть домовитися між собою про зони, але корективи адміністратора є остаточними.</p>
              </section>
            ) : null}
          </main>

          <aside className="duty-planner-side-v1">
            <section className="duty-planner-team-v1">
              <header><div><span className="eyebrow">Графік дня</span><h3>Працюють · {data.workingWaiters.length}</h3></div><UsersRound size={21} /></header>
              <div>
                {data.workingWaiters.map((worker) => (
                  <article key={worker.id}>
                    <span className="duty-planner-avatar-v1">{worker.avatar ? <img src={worker.avatar} alt="" loading="lazy" /> : initials(worker.name)}</span>
                    <div><strong>{worker.name}</strong><small>{worker.telegramLinked ? 'Telegram підключено' : 'Без Telegram'}</small></div>
                    <b>{worker.shift}</b>
                  </article>
                ))}
                {!data.workingWaiters.length ? <div className="duty-planner-no-team-v1"><CalendarDays size={25} /><strong>Офіціантів у графіку немає</strong><span>Для цієї дати неможливо створити призначення, доки не заповнено графік.</span></div> : null}
              </div>
            </section>

            <section className="duty-planner-publication-v1">
              <span className="eyebrow">Статус розсилки</span>
              {data.publication ? (
                <><h3>Опубліковано</h3><p>{formatMoment(data.publication.published_at)} · {data.publication.published_by || 'Адміністратор'}</p><div><span>Отримали</span><strong>{data.publication.telegram_sent}</strong></div><div><span>Без Telegram</span><strong>{data.publication.telegram_skipped}</strong></div></>
              ) : (
                <><h3>Ще не надіслано</h3><p>На головній сторінці працівників цей розподіл не показується до Telegram-публікації.</p></>
              )}
            </section>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
