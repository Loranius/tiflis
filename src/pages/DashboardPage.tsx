import { BellRing, CalendarCheck2, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';

interface ScheduleRow {
  date: string;
  shift: string | null;
}

interface NotificationRow {
  id: number;
  title: string;
  body: string | null;
  priority: string | null;
  created_at: string | null;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`));
}

export function DashboardPage() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    const today = new Date().toISOString().slice(0, 10);

    async function load() {
      const [scheduleResult, notificationsResult] = await Promise.all([
        supabase
          .from('schedule')
          .select('date,shift')
          .eq('user_id', userId)
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(7),
        supabase
          .from('notifications')
          .select('id,title,body,priority,created_at')
          .order('created_at', { ascending: false })
          .limit(3),
      ]);

      if (!scheduleResult.error) setSchedule((scheduleResult.data || []) as ScheduleRow[]);
      if (!notificationsResult.error) {
        setNotifications((notificationsResult.data || []) as NotificationRow[]);
      }
      setLoading(false);
    }

    void load();
  }, [user]);

  const nextShift = useMemo(
    () => schedule.find((row) => row.shift && !['Х', 'О', ''].includes(row.shift)),
    [schedule],
  );

  return (
    <div className="dashboard-stack">
      <section className="welcome-card">
        <div>
          <span className="eyebrow">Робочий простір</span>
          <h2>Привіт, {user?.displayName}</h2>
          <p>Новий портал уже працює на захищеній сесії. Модулі переноситимуться сюди поетапно без повернення до монолітного коду.</p>
        </div>
        <div className="welcome-symbol"><Sparkles size={34} /></div>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <CalendarCheck2 size={22} />
          <span>Наступна зміна</span>
          <strong>{loading ? '…' : nextShift ? `${formatDate(nextShift.date)} · ${nextShift.shift}` : 'Не призначено'}</strong>
        </article>
        <article className="metric-card">
          <BellRing size={22} />
          <span>Нові повідомлення</span>
          <strong>{loading ? '…' : notifications.length}</strong>
        </article>
        <article className="metric-card">
          <ShieldCheck size={22} />
          <span>Рівень доступу</span>
          <strong>{user?.role === 'sysadmin' ? 'Сисадмін' : user?.role}</strong>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel-card">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Найближчі дні</span>
              <h3>Мій графік</h3>
            </div>
          </div>
          <div className="schedule-list">
            {loading ? <p className="muted">Завантаження…</p> : null}
            {!loading && schedule.length === 0 ? <p className="muted">Записів у графіку поки немає.</p> : null}
            {schedule.map((row) => (
              <div className="schedule-row" key={row.date}>
                <span>{formatDate(row.date)}</span>
                <strong>{row.shift || 'Вихідний'}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Останнє</span>
              <h3>Сповіщення</h3>
            </div>
          </div>
          <div className="notification-list">
            {loading ? <p className="muted">Завантаження…</p> : null}
            {!loading && notifications.length === 0 ? <p className="muted">Нових повідомлень немає.</p> : null}
            {notifications.map((item) => (
              <div className="notification-item" key={item.id}>
                <span className={`priority-dot priority-${item.priority || 'medium'}`} />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body || 'Без додаткового тексту'}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
