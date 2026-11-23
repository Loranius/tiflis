-- Telegram group bot, round 2 (owner, 23 November 2026): thanks between
-- colleagues and saved notes. Server-only, like the other telegram_* tables.

create table if not exists public.telegram_thanks (
  id bigint generated always as identity primary key,
  chat_id bigint not null references public.telegram_chats(chat_id) on delete cascade,
  from_tg_id bigint not null,
  to_tg_id bigint not null,
  message_id bigint not null,
  created_at timestamptz not null default now(),
  constraint telegram_thanks_not_self check (from_tg_id <> to_tg_id),
  constraint telegram_thanks_once_per_message unique (chat_id, from_tg_id, message_id)
);
create index if not exists telegram_thanks_chat_time on public.telegram_thanks (chat_id, created_at);

create table if not exists public.telegram_notes (
  chat_id bigint not null references public.telegram_chats(chat_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 32),
  body text not null check (char_length(body) between 1 and 3500),
  created_by bigint,
  updated_at timestamptz not null default now(),
  primary key (chat_id, name)
);

alter table public.telegram_thanks enable row level security;
alter table public.telegram_notes enable row level security;
