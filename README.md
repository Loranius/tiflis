# Тифліс v2 — портал персоналу

`Loranius/tiflis` — активний репозиторій порталу персоналу ресторану «Тифліс».
Архівна vanilla-версія збережена в окремій гілці та в `Loranius/tiflisold` лише як джерело поведінки під час міграції модулів.

## Стек

- React + TypeScript + Vite
- Supabase Auth, PostgreSQL, RLS та Edge Functions
- React Router із hash-навігацією для статичного хостингу
- централізований ACL у `src/lib/acl.ts`
- адаптивний desktop/mobile інтерфейс

## Уже працює

- перший вхід через старий логін і пароль;
- автоматичне створення Supabase Auth-акаунта;
- сесія без збереження пароля в браузері;
- роль `sysadmin` для legacy-користувача `sysadmin`;
- захищений layout і рольова навігація;
- головна сторінка з реальним графіком та сповіщеннями;
- JWT-захищений API для Telegram-операцій;
- автоматичне видалення старих localStorage-сесій і service worker;
- CI-перевірка типів та production build.

## Локальний запуск

```bash
npm ci
cp .env.example .env
npm run dev
```

Publishable key дозволено використовувати у фронтенді. `service_role`, Telegram token та інші привілейовані секрети зберігаються тільки в Supabase Edge Function secrets.

## Нагадування про дні народження (Telegram)

Щодня о 07:00 UTC (09:00/10:00 за Києвом) `pg_cron` викликає Edge Function `tiflis-birthday-reminders`. Якщо завтра в когось із розділу «Персонал → День народження» день народження, усі активні користувачі з привʼязаним Telegram отримують нагадування — окрім самого іменинника. Іменинника визначаємо за полем «Акаунт у порталі» в редакторі запису (міграція автоматично привʼязала однозначні збіги за імʼям); для непривʼязаних записів — за збігом імені. Повторний запуск того ж дня не дублює повідомлення (`birthday_reminder_deliveries`).

Налаштування після деплою:

```bash
supabase secrets set BIRTHDAY_CRON_SECRET=<випадковий-рядок>
supabase functions deploy tiflis-birthday-reminders
```

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/tiflis-birthday-reminders', 'birthday_reminders_url');
select vault.create_secret('<той самий BIRTHDAY_CRON_SECRET>', 'birthday_reminders_secret');
```

Перевірка без відправки: `POST` на функцію з заголовком `x-cron-secret` і тілом `{"dry_run": true, "date": "2026-11-26"}` (`date` — дата дня народження).

## Структура

```text
src/
  auth/                 AuthProvider і міграційний вхід
  components/           оболонка та спільні компоненти
  lib/                   Supabase-клієнт і ACL
  pages/                 сторінки модулів
  App.tsx                захищений роутер
  styles.css             дизайн-система
supabase/
  migrations/            відтворювані зміни БД
  functions/
    tiflis-auth-migrate/ одноразовий перехід legacy → Auth
    tiflis-secure-api/   привілейовані JWT-операції
```

Стара vanilla-реалізація збережена в гілці `archive/vanilla-v2`. Папки `js/` та `css/` у поточній rewrite-гілці тимчасово залишені як довідник, але новий `index.html` їх не підключає.

## Порядок перенесення модулів

1. Графік
2. Каса та рейтинг
3. Меню і стоп-лист
4. Резерви
5. Персонал та Telegram
6. Обов'язки, сповіщення і журнал подій
7. Адмін-панель та остаточне ввімкнення RLS на legacy-таблицях

Кожен модуль переноситься вертикальним зрізом: UI → типізований сервіс → RLS-політики → тести → видалення відповідного legacy-коду.
