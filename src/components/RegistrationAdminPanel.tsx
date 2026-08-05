import { Check, RefreshCw, UserCheck, UserPlus, UserX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { secureApi } from '../lib/secureApi';
import './registration-admin.css';

type RequestStatus = 'pending' | 'approved' | 'rejected';

interface RegistrationRequest {
  id: string;
  auth_user_id: string | null;
  display_name: string;
  login: string;
  status: RequestStatus;
  assigned_role: string | null;
  legacy_user_id: string | null;
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
}

interface RegistrationResponse {
  ok: true;
  requests: RegistrationRequest[];
}

const ROLE_OPTIONS = [
  ['waiter', 'Офіціант'],
  ['bar', 'Бар'],
  ['cook', 'Кухар'],
  ['chef', 'Шеф-кухар'],
  ['hostess', 'Хостес'],
  ['runner', 'Ранер'],
  ['sommelier', 'Сомельє'],
  ['trainee', 'Стажер'],
  ['staff', 'Працівник'],
  ['admin', 'Адміністратор'],
] as const;

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export function RegistrationAdminPanel() {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await secureApi<RegistrationResponse>({ action: 'admin_bootstrap' }, 'tiflis-registration-api');
      setRequests(response.requests);
      setRoles((current) => {
        const next = { ...current };
        response.requests.forEach((item) => { if (!next[item.id]) next[item.id] = item.assigned_role || 'waiter'; });
        return next;
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити заявки.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pending = useMemo(() => requests.filter((item) => item.status === 'pending'), [requests]);
  const history = useMemo(() => requests.filter((item) => item.status !== 'pending').slice(0, 8), [requests]);

  async function decide(item: RegistrationRequest, decision: 'approve' | 'reject') {
    setSavingId(item.id);
    setError(null);
    setMessage(null);
    try {
      await secureApi<{ ok: true }>({
        action: 'admin_decide',
        request_id: item.id,
        decision,
        role: roles[item.id] || 'waiter',
      }, 'tiflis-registration-api');
      setMessage(decision === 'approve' ? `Доступ для ${item.display_name} підтверджено.` : `Заявку ${item.display_name} відхилено.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Рішення не збережено.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="registration-admin-v4">
      <header className="registration-admin-heading-v4">
        <div><span className="eyebrow">Доступ до порталу</span><h3>Заявки на реєстрацію</h3><p>Новий користувач отримає доступ лише після підтвердження та призначення ролі.</p></div>
        <div className="registration-count-v4"><UserPlus size={19} /><strong>{pending.length}</strong></div>
      </header>

      {message ? <div className="registration-feedback-v4 is-success"><Check size={16} /> {message}</div> : null}
      {error ? <div className="registration-feedback-v4 is-error">{error}</div> : null}
      {loading ? <div className="registration-loading-v4"><RefreshCw size={19} className="is-spinning" /> Завантажуємо заявки…</div> : null}

      {!loading ? (
        <div className="registration-list-v4">
          {pending.map((item) => (
            <article key={item.id} className="registration-request-v4">
              <div className="registration-person-v4">
                <span>{item.display_name.slice(0, 1).toUpperCase()}</span>
                <div><strong>{item.display_name}</strong><small>{item.display_name === item.login ? 'Ім’я та логін' : `Логін: ${item.login}`} · {formatDate(item.requested_at)}</small></div>
              </div>
              <label><span>Роль після підтвердження</span><select value={roles[item.id] || 'waiter'} onChange={(event) => setRoles({ ...roles, [item.id]: event.target.value })}>{ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <div className="registration-actions-v4">
                <button type="button" className="is-reject" disabled={savingId === item.id} onClick={() => void decide(item, 'reject')}><UserX size={16} /> Відхилити</button>
                <button type="button" className="is-approve" disabled={savingId === item.id} onClick={() => void decide(item, 'approve')}>{savingId === item.id ? <RefreshCw size={16} className="is-spinning" /> : <UserCheck size={16} />} Підтвердити</button>
              </div>
            </article>
          ))}
          {pending.length === 0 ? <div className="registration-empty-v4"><UserCheck size={26} /><strong>Нових заявок немає</strong><span>Коли хтось зареєструється, адміністратори отримають повідомлення в Telegram.</span></div> : null}
        </div>
      ) : null}

      {!loading && history.length > 0 ? (
        <div className="registration-history-v4"><h4>Останні рішення</h4>{history.map((item) => <div key={item.id}><span className={`status-${item.status}`}>{item.status === 'approved' ? 'Погоджено' : 'Відхилено'}</span><strong>{item.display_name}</strong><small>{item.display_name === item.login ? 'Ім’я та логін збігаються' : `Логін: ${item.login}`} · {item.decided_by || 'Адміністратор'} · {formatDate(item.decided_at)}</small></div>)}</div>
      ) : null}
    </section>
  );
}
