import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eraser,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  loadDutyPlan,
  publishDutyPlan,
  saveDutyPlan,
  type DutyPlanDraft,
  type DutyPlanResponse,
  type DutyPlanType,
  type WorkingWaiter,
} from '../lib/dutyPlannerClient';
import {
  clearDutyPlannerDraft,
  readDutyPlannerDate,
  readDutyPlannerDraft,
  rememberDutyPlannerDate,
  rememberDutyPlannerDraft,
} from '../lib/dutyPlannerDrafts';
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

function restoredInitialDate(ownerId: string, type: DutyPlanType): string {
  const stored = readDutyPlannerDate(ownerId, type);
  return stored || initialDate(type);
}

function workerLabel(worker: WorkingWaiter): string {
  return `${worker.name} · ${worker.shift}`;
}

function monthKey(value: string): string {
  return value.slice(0, 7);
}

function moveCalendarMonth(value: string, delta: number): string {
  const [yearText = '', monthText = ''] = value.split('-');
  const date = new Date(Number(yearText), Number(monthText) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function tuesdaysForMonth(value: string): string[] {
  const [yearText = '', monthText = ''] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  const result: string[] = [];
  const date = new Date(year, month, 1, 12);
  while (date.getDay() !== 2) date.setDate(date.getDate() + 1);
  while (date.getMonth() === month) {
    result.push(localIso(date));
    date.setDate(date.getDate() + 7);
  }
  return result;
}

function calendarMonthLabel(value: string): string {
  const [yearText = '', monthText = ''] = value.split('-');
  return new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' })
    .format(new Date(Number(yearText), Number(monthText) - 1, 1));
}

function compactTuesday(value: string): { day: string; date: string } {
  const date = new Date(`${value}T12:00:00`);
  return {
    day: new Intl.DateTimeFormat('uk-UA', { day: '2-digit' }).format(date),
    date: new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' }).format(date),
  };
}

function trimZoneValues(values: string[]): string[] {
  const next = [...values];
  while (next.length && !next[next.length - 1]) next.pop();
  return next.slice(0, 3);
}

export function DutyPlannerPage({
  planType,
  eyebrow,
  title,
  description,
  icon: Icon,
}: DutyPlannerPageProps) {
  const { user } = useAuth();
  const ownerId = user?.id || 'active-session';
  const [date, setDate] = useState(() => restoredInitialDate(ownerId, planType));
  const [calendarMonth, setCalendarMonth] = useState(() => monthKey(restoredInitialDate(ownerId, planType)));
  const [calendarOpen, setCalendarOpen] = useState(false);
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
    const restored = readDutyPlannerDraft(ownerId, response.planType, response.date);
    if (restored) {
      const dutyMap: DutySelections = {};
      response.definitions.forEach((definition) => {
        const value = restored.duties[definition.key];
        if (typeof value === 'string') dutyMap[definition.key] = value;
      });
      const zoneMap: ZoneSelections = {};
      response.zones.forEach((zone) => {
        zoneMap[zone.key] = trimZoneValues(restored.zones[zone.key] || []);
      });
      setDuties(dutyMap);
      setZones(zoneMap);
      setDirty(true);
      setNotice('Відновлено останні незбережені зміни.');
      return;
    }

    const dutyMap: DutySelections = {};
    response.assignments.forEach((item) => { dutyMap[item.duty_key] = item.assignee_id; });
    const zoneMap: ZoneSelections = {};
    response.zones.forEach((zone) => { zoneMap[zone.key] = []; });
    response.zoneAssignments.forEach((item) => {
      const current = [...(zoneMap[item.zone_key] || [])];
      current[item.slot - 1] = item.assignee_id;
      zoneMap[item.zone_key] = trimZoneValues(current);
    });
    setDuties(dutyMap);
    setZones(zoneMap);
    setDirty(false);
  }, [ownerId]);

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

  useEffect(() => {
    rememberDutyPlannerDate(ownerId, planType, date);
  }, [date, ownerId, planType]);

  useEffect(() => {
    if (!dirty || !data?.permissions.canManage) return;
    rememberDutyPlannerDraft(ownerId, planType, date, { duties, zones });
  }, [data?.permissions.canManage, date, dirty, duties, ownerId, planType, zones]);

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
  const tuesdays = useMemo(() => tuesdaysForMonth(calendarMonth), [calendarMonth]);

  function requestDate(next: string) {
    const normalized = planType === 'handover' ? tuesdayForWeek(next) : next;
    if (normalized === date) {
      setCalendarOpen(false);
      return;
    }
    if (dirty) rememberDutyPlannerDraft(ownerId, planType, date, { duties, zones });
    setDirty(false);
    setDate(normalized);
    setCalendarMonth(monthKey(normalized));
    setCalendarOpen(false);
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
      const next = [...(current[zoneKey] || [])];
      while (next.length <= slot) next.push('');
      next[slot] = assigneeId;
      return { ...current, [zoneKey]: assigneeId ? next.slice(0, 3) : trimZoneValues(next) };
    });
    setDirty(true);
    setNotice(null);
  }

  function addZoneSlot(zoneKey: string) {
    setZones((current) => {
      const values = current[zoneKey] || [];
      if (!values.length || !values[values.length - 1] || values.length >= 3) return current;
      return { ...current, [zoneKey]: [...values, ''] };
    });
  }

  function removeZoneSlot(zoneKey: string, slot: number) {
    setZones((current) => {
      const next = [...(current[zoneKey] || [])];
      next.splice(slot, 1);
      return { ...current, [zoneKey]: trimZoneValues(next) };
    });
    setDirty(true);
    setNotice(null);
  }

  function clearPlan() {
    if (!window.confirm('Очистити всі призначення на вибрану дату?')) return;
    setDuties({});
    setZones(Object.fromEntries((data?.zones || []).map((zone) => [zone.key, []])));
    setDirty(true);
    setNotice(null);
  }

  function draft(): DutyPlanDraft {
    return {
      assignments: Object.entries(duties)
        .filter(([, assigneeId]) => Boolean(assigneeId))
        .map(([dutyKey, assigneeId]) => ({ duty_key: dutyKey, assignee_id: assigneeId })),
      zones: planType === 'daily'
        ? Object.entries(zones).flatMap(([zoneKey, assignees]) => assignees
          .map((assigneeId, index) => ({ zone_key: zoneKey, slot: index + 1, assignee_id: assigneeId }))
          .filter((item) => Boolean(item.assignee_id)))
        : [],
    };
  }

  async function save() {
    if (!data?.permissions.canManage) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveDutyPlan(planType, date, draft());
      clearDutyPlannerDraft(ownerId, planType, date);
      setDirty(false);
      setNotice('Розподіл збережено.');
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

  async function saveAndPublish() {
    if (!data?.permissions.canManage || !hasPlan) return;
    setSaving(true);
    setPublishing(true);
    setError(null);
    setNotice(null);
    let saved = false;
    try {
      await saveDutyPlan(planType, date, draft());
      saved = true;
      clearDutyPlannerDraft(ownerId, planType, date);
      setDirty(false);
      const response = await publishDutyPlan(planType, date);
      setNotice(`Збережено й надіслано в Telegram: ${response.sent}; без Telegram: ${response.skipped}.`);
      await load();
    } catch (reason) {
      const fallback = saved
        ? 'Розподіл збережено, але не вдалося надіслати його в Telegram.'
        : 'Не вдалося зберегти й надіслати розподіл.';
      setError(reason instanceof Error ? reason.message : fallback);
    } finally {
      setSaving(false);
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
        <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>
        <div className="duty-planner-mark-v1"><Icon size={34} /></div>
      </section>

      <section className="duty-planner-toolbar-v1">
        <div className="duty-planner-date-v1">
          <button type="button" onClick={() => requestDate(addDays(date, -dateStep))} aria-label="Попередня дата"><ChevronLeft size={18} /></button>
          {planType === 'handover' ? (
            <button type="button" className="duty-planner-tuesday-trigger-v2" onClick={() => { setCalendarMonth(monthKey(date)); setCalendarOpen(true); }}>
              <span>Вівторок</span><strong>{formatDate(date, true)}</strong><CalendarDays size={18} />
            </button>
          ) : (
            <label><span>Дата</span><input type="date" value={date} onChange={(event) => requestDate(event.target.value)} /></label>
          )}
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
      {dirty ? <div className="duty-planner-unsaved-v1">Є незбережені зміни. Чернетку збережено на цьому пристрої.</div> : null}
      {loading ? <div className="duty-planner-loading-v1"><RefreshCw size={23} className="is-spinning" /><span>Підтягуємо графік і призначення…</span></div> : null}

      {!loading && data ? (
        <div className="duty-planner-layout-v1">
          <main className="duty-planner-main-v1">
            <section className="duty-planner-card-v1">
              <header className="duty-planner-card-heading-v1"><div><span className="eyebrow">{formatDate(date, true)}</span><h3>Таблиця обов’язків</h3></div><div className="duty-planner-count-v1"><strong>{assignedDutyCount}</strong><span>призначено</span></div></header>
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
                          <td>{data.permissions.canManage ? (
                            <select value={value} onChange={(event) => setDuty(duty.key, event.target.value)}><option value="">— Не призначено —</option>{staleDutyOption(duty.key, value)}{data.workingWaiters.map((worker) => <option value={worker.id} key={worker.id}>{workerLabel(worker)}</option>)}</select>
                          ) : value ? (
                            <span className={`duty-planner-person-v1 ${assignment?.assignee_working === false ? 'is-stale' : ''}`}>{assignment?.assignee_name || value}<small>{assignment?.assignee_shift || 'не в графіку'}</small></span>
                          ) : <span className="duty-planner-empty-v1">Не призначено</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {planType === 'daily' ? (
              <section className="duty-planner-card-v1 is-zones">
                <header className="duty-planner-card-heading-v1"><div><span className="eyebrow">Розподіл залів</span><h3>Зони роботи</h3></div><div className="duty-planner-count-v1"><strong>{assignedZoneCount}</strong><span>призначено</span></div></header>
                <p className="duty-planner-zone-note-v1">Спочатку оберіть одного офіціанта. Плюс поруч додає ще одного, якщо це справді потрібно.</p>
                <div className="duty-planner-zone-list-v2">
                  {data.zones.map((zone) => {
                    const storedValues = zones[zone.key] || [];
                    const values = storedValues.length ? storedValues : [''];
                    const savedSlots = savedZoneMap.get(zone.key);
                    return (
                      <article key={zone.key} className="duty-planner-zone-card-v2">
                        <header><strong>{zone.title}</strong><small>{storedValues.filter(Boolean).length ? `${storedValues.filter(Boolean).length} офіціант.` : 'Не призначено'}</small></header>
                        {data.permissions.canManage ? (
                          <div className="duty-planner-zone-rows-v2">
                            {values.map((value, slot) => {
                              const usedByOtherSlots = new Set(storedValues.filter((item, index) => Boolean(item) && index !== slot));
                              const canAdd = Boolean(value) && slot === values.length - 1 && values.length < 3;
                              return (
                                <div className="duty-planner-zone-row-v2" key={`${zone.key}-${slot}`}>
                                  <select value={value} onChange={(event) => setZone(zone.key, slot, event.target.value)}>
                                    <option value="">— Не призначено —</option>
                                    {staleZoneOption(zone.key, slot, value)}
                                    {data.workingWaiters.filter((worker) => !usedByOtherSlots.has(worker.id)).map((worker) => <option value={worker.id} key={worker.id}>{workerLabel(worker)}</option>)}
                                  </select>
                                  {canAdd ? <button type="button" className="is-add" onClick={() => addZoneSlot(zone.key)} aria-label="Додати офіціанта"><Plus size={18} /></button> : null}
                                  {slot > 0 ? <button type="button" className="is-remove" onClick={() => removeZoneSlot(zone.key, slot)} aria-label="Прибрати офіціанта"><Trash2 size={17} /></button> : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : storedValues.some(Boolean) ? (
                          <div className="duty-planner-zone-people-v1">{storedValues.filter(Boolean).map((id, index) => {
                            const worker = workerMap.get(id);
                            const saved = savedSlots?.get(index + 1);
                            return <span className={`duty-planner-person-v1 ${!worker ? 'is-stale' : ''}`} key={`${id}-${index}`}>{worker?.name || saved?.assignee_name || id}<small>{worker?.shift || saved?.assignee_shift || 'не в графіку'}</small></span>;
                          })}</div>
                        ) : <span className="duty-planner-free-zone-v1">Вільна зона</span>}
                      </article>
                    );
                  })}
                </div>
                <p className="duty-planner-rule-v1">Корективи адміністратора є остаточними.</p>
              </section>
            ) : null}

            {data.permissions.canManage ? (
              <section className="duty-planner-bottom-actions-v2">
                <button type="button" className="is-save" onClick={() => void save()} disabled={!dirty || saving || publishing}>{saving && !publishing ? <RefreshCw size={18} className="is-spinning" /> : <Save size={18} />} Зберегти</button>
                <button type="button" className="is-send" onClick={() => void saveAndPublish()} disabled={!hasPlan || saving || publishing}>{publishing ? <RefreshCw size={18} className="is-spinning" /> : <Send size={18} />} Зберегти й відправити в Telegram</button>
              </section>
            ) : null}
          </main>

          <aside className="duty-planner-side-v1">
            <section className="duty-planner-team-v1">
              <header><div><span className="eyebrow">Графік дня</span><h3>Працюють · {data.workingWaiters.length}</h3></div><UsersRound size={21} /></header>
              <div>{data.workingWaiters.map((worker) => <article key={worker.id}><span className="duty-planner-avatar-v1">{worker.avatar ? <img src={worker.avatar} alt="" loading="lazy" /> : initials(worker.name)}</span><div><strong>{worker.name}</strong><small>{worker.telegramLinked ? 'Telegram підключено' : 'Без Telegram'}</small></div><b>{worker.shift}</b></article>)}{!data.workingWaiters.length ? <div className="duty-planner-no-team-v1"><CalendarDays size={25} /><strong>Офіціантів у графіку немає</strong><span>Для цієї дати неможливо створити призначення, доки не заповнено графік.</span></div> : null}</div>
            </section>
            <section className="duty-planner-publication-v1"><span className="eyebrow">Статус розсилки</span>{data.publication ? <><h3>Опубліковано</h3><p>{formatMoment(data.publication.published_at)} · {data.publication.published_by || 'Адміністратор'}</p><div><span>Отримали</span><strong>{data.publication.telegram_sent}</strong></div><div><span>Без Telegram</span><strong>{data.publication.telegram_skipped}</strong></div></> : <><h3>Ще не надіслано</h3><p>На головній сторінці працівників цей розподіл не показується до Telegram-публікації.</p></>}</section>
          </aside>
        </div>
      ) : null}

      {calendarOpen && planType === 'handover' ? (
        <div className="duty-tuesday-calendar-backdrop-v2" onMouseDown={() => setCalendarOpen(false)}>
          <section className="duty-tuesday-calendar-v2" role="dialog" aria-modal="true" aria-label="Вибір вівторка" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span className="eyebrow">Календар здачі зміни</span><h3>{calendarMonthLabel(calendarMonth)}</h3></div><button type="button" onClick={() => setCalendarOpen(false)} aria-label="Закрити"><X size={19} /></button></header>
            <div className="duty-tuesday-calendar-nav-v2"><button type="button" onClick={() => setCalendarMonth((value) => moveCalendarMonth(value, -1))}><ChevronLeft size={19} /></button><strong>Лише вівторки</strong><button type="button" onClick={() => setCalendarMonth((value) => moveCalendarMonth(value, 1))}><ChevronRight size={19} /></button></div>
            <div className="duty-tuesday-list-v2">{tuesdays.map((tuesday) => { const label = compactTuesday(tuesday); return <button type="button" key={tuesday} className={tuesday === date ? 'is-selected' : ''} onClick={() => requestDate(tuesday)}><span>{label.day}</span><div><strong>Вівторок</strong><small>{label.date}</small></div>{tuesday === date ? <Check size={18} /> : <ChevronRight size={18} />}</button>; })}</div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
