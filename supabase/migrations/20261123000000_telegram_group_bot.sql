-- The Tiflis bot in the staff group chat (spec 2026-11-23-telegram-group-bot).
-- Service-role only: RLS on, no policies.

create table if not exists public.telegram_chats (
  chat_id bigint primary key,
  title text,
  enabled boolean not null default false,
  added_by bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_chat_members (
  chat_id bigint not null references public.telegram_chats (chat_id) on delete cascade,
  tg_id bigint not null,
  username text,
  first_name text not null default '',
  last_name text,
  manual_role text check (manual_role in ('waiter', 'bar', 'cook', 'chef', 'runner', 'hostess', 'admin')),
  last_seen timestamptz not null default now(),
  left_at timestamptz,
  primary key (chat_id, tg_id)
);

create table if not exists public.telegram_daily_picks (
  chat_id bigint not null,
  pick_date date not null,
  kind text not null,
  value text not null,
  primary key (chat_id, pick_date, kind)
);

alter table public.telegram_chats enable row level security;
alter table public.telegram_chat_members enable row level security;
alter table public.telegram_daily_picks enable row level security;

comment on table public.telegram_chats is 'Group chats the Tiflis bot is in; it answers only where enabled.';
comment on table public.telegram_chat_members is 'People the bot has seen in each chat, with an optional manual role.';
comment on table public.telegram_daily_picks is 'Stable once-a-day answers (e.g. /best) per chat.';
