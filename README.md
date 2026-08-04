# Тифліс v2 — портал персоналу

`tiflisv2` — єдиний активний репозиторій порталу персоналу ресторану «Тифліс».
Старий `Loranius/tiflis` використовується лише як архів і джерело поведінки під час міграції модулів.

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
npm install
cp .env.example .env
npm run dev
```

Publishable key дозволено використовувати у фронтенді. `service_role`, Telegram token та інші привілейовані секрети зберігаються тільки в Supabase Edge Function secrets.

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
