import { Bot, Check, RefreshCw, Search, UserMinus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CHAT_ROLE_LABELS,
  CHAT_ROLES,
  displayChatName,
  effectiveChatRoles,
  filterChatMembers,
  sortChatMembers,
  type ChatMember,
  type ChatRole,
  type ChatRoleFilter,
  type ChatRoom,
} from '../lib/chatRoles';
import { secureApi } from '../lib/secureApi';
import './chat-roles.css';

/*
 * Who is who in the staff Telegram chat (spec 2026-11-23-telegram-group-bot).
 * The bot reads roles from portal accounts; here an admin sets a role by hand
 * for people who are not on the portal (or overrides one), the same as
 * replying /role in the chat.
 */

interface ChatRolesResponse { ok: true; chats: ChatRoom[] }

const FILTERS: Array<{ key: ChatRoleFilter; label: string }> = [
  { key: 'all', label: 'Усі' },
  { key: 'none', label: 'Без ролі' },
  { key: 'manual', label: 'Вручну' },
  { key: 'portal', label: 'З порталу' },
];

function rolesText(roles: ChatRole[]): string {
  return roles.map((role) => CHAT_ROLE_LABELS[role]).join(' + ');
}

export function ChatRolesPanel() {
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ChatRoleFilter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((next: ChatRoom[]) => {
    setChats(next);
    setChatId((current) => current && next.some((chat) => chat.chat_id === current)
      ? current
      : (next.find((chat) => chat.enabled) ?? next[0])?.chat_id ?? null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await secureApi<ChatRolesResponse>({ action: 'admin_chat_roles' }, 'tiflis-admin-api');
      apply(response.chats);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити учасників чату.');
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => { void load(); }, [load]);

  const chat = chats.find((item) => item.chat_id === chatId) ?? null;
  const counts = useMemo(() => {
    const members = chat?.members ?? [];
    const tally: Record<ChatRoleFilter, number> = { all: members.length, none: 0, manual: 0, portal: 0 };
    for (const member of members) tally[effectiveChatRoles(member).source] += 1;
    return tally;
  }, [chat]);
  const visible = useMemo(
    () => sortChatMembers(filterChatMembers(chat?.members ?? [], filter, query)),
    [chat, filter, query],
  );

  async function save(member: ChatMember, action: 'admin_set_chat_role' | 'admin_remove_chat_member', role: ChatRole | null = null) {
    if (!chat) return;
    setSavingId(member.tg_id);
    setError(null);
    setMessage(null);
    try {
      const response = await secureApi<ChatRolesResponse>({
        action,
        chat_id: chat.chat_id,
        tg_id: member.tg_id,
        role,
      }, 'tiflis-admin-api');
      apply(response.chats);
      const name = displayChatName(member);
      setMessage(action === 'admin_remove_chat_member'
        ? `${name} прибрано зі списку. Напише в чат — бот додасть знову.`
        : role ? `${name}: ${CHAT_ROLE_LABELS[role]}.` : `${name}: роль знову з порталу.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не збережено.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="admin-panel-v2 chat-roles">
      <div className="admin-panel-heading-v2">
        <div><span className="eyebrow">Telegram-бот</span><h3>Ролі в чаті</h3></div>
        <Bot size={22} />
      </div>
      <p className="admin-muted-v2">
        Бот бере ролі з акаунтів порталу з привʼязаним Telegram. Тим, кого немає на порталі, признач роль тут —
        тоді /kitchen, /waiters та інші виклики їх знайдуть. Роль, задана вручну, важливіша за портальну.
      </p>

      {chats.length > 1 ? (
        <div className="chat-roles__chats" role="tablist" aria-label="Чати">
          {chats.map((item) => (
            <button type="button" key={item.chat_id} role="tab" aria-selected={item.chat_id === chatId} className={item.chat_id === chatId ? 'is-active' : ''} onClick={() => setChatId(item.chat_id)}>
              {item.title}{item.enabled ? null : <small>вимкнений</small>}
            </button>
          ))}
        </div>
      ) : null}

      {message ? <div className="chat-roles__feedback is-success"><Check size={15} /> {message}</div> : null}
      {error ? <div className="chat-roles__feedback is-error">{error}</div> : null}
      {loading ? <div className="chat-roles__loading"><RefreshCw size={18} className="is-spinning" /> Завантажуємо учасників…</div> : null}

      {!loading && !chat ? (
        <div className="chat-roles__empty"><Bot size={26} /><strong>Бот ще не доданий у чат</strong><span>Додай бота в робочий чат Telegram — і учасники зʼявляться тут.</span></div>
      ) : null}

      {!loading && chat ? (
        <>
          <div className="chat-roles__tools">
            <div className="chat-roles__filters" role="group" aria-label="Фільтр">
              {FILTERS.map((item) => (
                <button type="button" key={item.key} className={filter === item.key ? 'is-active' : ''} aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>
                  {item.label}<b className={item.key === 'none' && counts.none > 0 ? 'is-alert' : ''}>{counts[item.key]}</b>
                </button>
              ))}
            </div>
            <label className="chat-roles__search">
              <Search size={15} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Імʼя або @нік" aria-label="Пошук учасника" />
            </label>
          </div>

          <div className="chat-roles__list">
            {visible.map((member) => {
              const effective = effectiveChatRoles(member);
              const portalRoles = effectiveChatRoles({ ...member, manual_role: null });
              const saving = savingId === member.tg_id;
              const name = displayChatName(member);
              return (
                <article key={member.tg_id} className={`chat-roles__row is-${effective.source}`}>
                  <span className="chat-roles__avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
                  <div className="chat-roles__who">
                    <strong>{name}</strong>
                    <small>
                      {member.username ? `@${member.username}` : 'без ніку'}
                      {' · '}
                      {member.portal ? (member.portal.name === member.name ? 'на порталі' : `у Telegram: ${member.name}`) : 'немає на порталі'}
                    </small>
                  </div>
                  <span className={`chat-roles__badge is-${effective.source}`}>
                    {effective.source === 'none' ? 'Без ролі' : rolesText(effective.roles)}
                    {effective.source === 'manual' ? <i>вручну</i> : null}
                  </span>
                  <div className="chat-roles__actions">
                    <select
                      aria-label={`Роль для ${name}`}
                      value={member.manual_role ?? ''}
                      disabled={saving}
                      onChange={(event) => void save(member, 'admin_set_chat_role', (event.target.value || null) as ChatRole | null)}
                    >
                      <option value="">{portalRoles.source === 'portal' ? `З порталу: ${rolesText(portalRoles.roles)}` : 'Не призначено'}</option>
                      {CHAT_ROLES.map((role) => <option key={role} value={role}>{CHAT_ROLE_LABELS[role]}</option>)}
                    </select>
                    <button
                      type="button"
                      className="chat-roles__remove"
                      disabled={saving}
                      title="Прибрати зі списку (людина вийшла з чату)"
                      aria-label={`Прибрати ${name} зі списку`}
                      onClick={() => { if (window.confirm(`Прибрати ${name} зі списку чату? Якщо людина напише в чат, бот додасть її знову.`)) void save(member, 'admin_remove_chat_member'); }}
                    >
                      {saving ? <RefreshCw size={15} className="is-spinning" /> : <UserMinus size={15} />}
                    </button>
                  </div>
                </article>
              );
            })}
            {visible.length === 0 ? <p className="admin-muted-v2">{query || filter !== 'all' ? 'Нікого не знайдено.' : 'Бот ще нікого не бачив у цьому чаті.'}</p> : null}
          </div>
          <p className="admin-footnote-v2">
            Telegram не показує ботам список учасників: людина зʼявляється тут, щойно напише в чат, або якщо в неї є акаунт на порталі з привʼязаним Telegram.
          </p>
        </>
      ) : null}
    </section>
  );
}
