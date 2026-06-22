# Портал персоналу «Тифліс»

Внутрішній портал персоналу ресторану. Vanilla JS + Supabase, PWA, деплой на GitHub Pages / Cloudflare Pages.

Раніше це був один файл `index.html` (~12k рядків). Тепер код розбито на модулі без зміни логіки: `index.html` — це тонка оболонка, яка підключає CSS і JS файли по черзі.

## Структура

```
.
├── index.html              # оболонка: <head> + розмітка + підключення css/js
├── manifest.json           # PWA-маніфест
├── sw.js                   # service worker (кеш v4, network-first для HTML)
├── icon-180/192/512.png    # іконки PWA
├── css/                    # стилі (підключаються в порядку каскаду)
│   ├── 01-base.css             змінні й базові стилі
│   ├── 02-login.css            екран входу
│   ├── 03-interface.css        головний інтерфейс
│   ├── 04-schedule.css         графік
│   ├── 05-cash.css             каса
│   ├── 06-rating.css           рейтинг
│   ├── 07-staff.css            персонал
│   ├── 08-duties.css           обов'язки
│   └── 09-calendar-menu.css    календар каси + меню
└── js/                     # скрипти (КЛАСИЧНІ, порядок підключення = порядок виконання)
    ├── 00-utils-security.js    утиліти безпеки + константи (esc, showConfirm, SHIFT_*)
    ├── 01-supabase-db.js       Supabase-клієнт + LocalStorage DB (sb, cache, DB)
    ├── 02-uploads.js           завантаження зображень у Supabase Storage
    ├── 03-menu.js              меню (дані, секції, категорії, об'єкт Menu)
    ├── 04-utils.js             хелпери: $, toast, modal, дати, юзери
    ├── 05-app.js               App — навігація, логін, сесія, ініціалізація
    ├── 06-schedule.js          графік змін (Schedule)
    ├── 07-cash.js              каса: виручка, чайові, статистика (Cash)
    ├── 08-rating.js            рейтинг персоналу й каси (Rating)
    ├── 09-staff.js             персонал: список, профілі (Staff)
    ├── 10-duties.js            здача зміни + щоденні обов'язки (Duties)
    ├── 11-telegram.js          EDGE_URL, PORTAL_KEY, tg* хелпери (виклики edge function)
    ├── 12-admin.js             адмін-панель (Admin)
    ├── 13-home.js              головна сторінка + іконки (Home, HOME_ICONS)
    ├── 14-theme.js             теми оформлення (Theme)
    ├── 15-notify.js            сповіщення / редактор шаблонів (Notify)
    ├── 16-interactive.js       інтерактив (Interactive)
    ├── 17-horoscope.js         гороскоп (Horoscope)
    ├── 18-reserve.js           бронювання столиків (Reserve)
    ├── 19-shiftswap.js         обмін змінами (ShiftSwap)
    ├── 20-eventlog.js          журнал подій (EventLog)
    └── 21-bootstrap.js         СТАРТ — слухачі подій + відновлення сесії + реєстрація SW
```

## Чому класичні `<script>`, а не ES-модулі

Код повністю покладається на глобальні об'єкти (`App`, `Home`, `Schedule`…) та inline-обробники в розмітці (`onclick="App.navigate(...)"`). Усі класичні скрипти на сторінці ділять один глобальний lexical-scope, тому розбивка на файли еквівалентна одному `<script>` — жоден inline-обробник і жодне глобальне посилання не ламаються. ES-модулі мають власний scope і вимагали б вішати кожен об'єкт на `window`, тому їх свідомо не використано.

**Важливо:** порядок підключення у `index.html` = порядок виконання. `00-utils-security.js` має йти першим, `21-bootstrap.js` — завжди останнім (він стартує застосунок). Не міняйте порядок без потреби.

## Конфігурація

- Supabase URL / anon key — у `js/01-supabase-db.js` (`SUPA_URL`, `SUPA_KEY`).
- Edge function для Telegram/гороскопа — у `js/11-telegram.js` (`EDGE_URL`, `PORTAL_KEY`).

## Деплой

GitHub Pages: запушити вміст репозиторію в `main`, увімкнути Pages з кореня. Шляхи відносні (`./css/...`, `./js/...`), тож працює і з підкаталогу.

Після зміни css/js файлів підніміть версію кешу в `sw.js` (`CACHE_NAME = 'tiflis-portal-vN'`), інакше у користувачів лишиться стара версія з кешу.
