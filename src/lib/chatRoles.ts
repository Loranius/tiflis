/*
 * Roles in the staff Telegram chat, as the group bot resolves them
 * (supabase/functions/tiflis-telegram-bot/logic.ts): a role set by hand wins,
 * else the linked portal account's role and second role, else none.
 * No imports beyond types: tested from Node.
 */

export type ChatRole = 'waiter' | 'bar' | 'cook' | 'chef' | 'runner' | 'hostess' | 'admin';

export interface ChatMember {
  tg_id: string;
  username: string | null;
  name: string;
  manual_role: ChatRole | null;
  last_seen: string | null;
  portal: { id: string; name: string; role: string | null; role2: string | null } | null;
}

export interface ChatRoom {
  chat_id: string;
  title: string;
  enabled: boolean;
  members: ChatMember[];
}

export const CHAT_ROLE_LABELS: Record<ChatRole, string> = {
  waiter: 'Офіціант',
  bar: 'Бармен',
  cook: 'Кухар',
  chef: 'Шеф',
  runner: 'Ранер',
  hostess: 'Хостес',
  admin: 'Адмін',
};

export const CHAT_ROLES = Object.keys(CHAT_ROLE_LABELS) as ChatRole[];

export type ChatRoleSource = 'manual' | 'portal' | 'none';
export type ChatRoleFilter = 'all' | ChatRoleSource;

export function normalizeChatRole(value: string | null | undefined): ChatRole | null {
  const role = (value || '').trim().toLowerCase();
  if (role === 'barman' || role === 'bartender' || role === 'bar') return 'bar';
  if (role === 'sysadmin' || role === 'admin') return 'admin';
  return (CHAT_ROLES as string[]).includes(role) ? role as ChatRole : null;
}

/** What the bot will treat this person as, and where that comes from. */
export function effectiveChatRoles(member: ChatMember): { roles: ChatRole[]; source: ChatRoleSource } {
  if (member.manual_role) return { roles: [member.manual_role], source: 'manual' };
  const roles = [normalizeChatRole(member.portal?.role), normalizeChatRole(member.portal?.role2)]
    .filter((role, index, all): role is ChatRole => Boolean(role) && all.indexOf(role) === index);
  return roles.length ? { roles, source: 'portal' } : { roles: [], source: 'none' };
}

/** People without a role first (they need attention), then by name. */
export function sortChatMembers(members: ChatMember[]): ChatMember[] {
  const rank: Record<ChatRoleSource, number> = { none: 0, manual: 1, portal: 2 };
  return [...members].sort((left, right) => {
    const byRank = rank[effectiveChatRoles(left).source] - rank[effectiveChatRoles(right).source];
    return byRank || displayChatName(left).localeCompare(displayChatName(right), 'uk');
  });
}

export function filterChatMembers(members: ChatMember[], filter: ChatRoleFilter, query: string): ChatMember[] {
  const needle = query.trim().toLowerCase();
  return members.filter((member) => {
    if (filter !== 'all' && effectiveChatRoles(member).source !== filter) return false;
    if (!needle) return true;
    return [member.name, member.username, member.portal?.name].some((value) => (value || '').toLowerCase().includes(needle));
  });
}

export function displayChatName(member: ChatMember): string {
  return member.portal?.name || member.name;
}
