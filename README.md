# Тифліс v2 — портал персоналу

Повністю новий портал: vanilla JS, без збірки, без залежностей.
Хостинг — GitHub Pages, бекенд — Supabase (REST, без supabase-js).

## Головна ідея v2

1. **Демо-режим з коробки.** Порожній `config.js` → портал працює на
   локальних мок-даних (localStorage). Відкрив `index.html` — і все клікабельне.
2. **ACL в одному файлі** (`js/core/acl.js`). Усі права ролей — один
   декларативний конфіг. Меню, гарди навігації та кнопки дій читають
   його ж, тому розсинхрон неможливий. Адмін може перекривати
   видимість сторінок через Управління → Доступи.
3. **Store — єдиний шар даних** (`js/lib/store.js`). Сторінки не знають,
   демо це чи Supabase. Всі виклики: `Store.list / insert / update /
   remove / upsert`, підписки — `Store.onChange`.
4. **Автозбереження скрізь.** Графік зберігає кожен тап по клітинці,
   доступи — кожен перемикач. Кнопок «Зберегти» на сторінках немає.

## Структура

```
index.html
config.js                 ← сюди Supabase URL + anon key
manifest.webmanifest, sw.js  ← PWA (піднімай VERSION у sw.js при деплої)
css/  tokens.css base.css components.css pages.css
js/
  lib/   utils.js demo-data.js store.js
  core/  ui.js acl.js auth.js router.js
  pages/ today.js schedule.js cash.js staff.js menu.js reserve.js admin.js
  app.js
supabase/schema.sql
```

## Підключення Supabase

1. Supabase → SQL Editor → виконай `supabase/schema.sql`
2. Project Settings → API → скопіюй URL і anon key у `config.js`
3. Задеплой на GitHub Pages. Готово.

Вхід — ім'я + PIN з таблиці `users`. Перший сисадмін створюється
скриптом (Діма / 0000 — зміни PIN одразу).

## Демо-акаунти (демо-режим)

| Ім'я | PIN | Роль |
|---|---|---|
| Діма | 0000 | сисадмін |
| Тамара | 1111 | адмін + хостес |
| Оксана | 2222 | офіціант |
| Сергій | 3333 | кухар |
| Максим | 4444 | шеф-кухар |
| Ніно | 5555 | хостес |
| Артем | 6666 | ранер |

«Скинути демо-дані» — Управління → Доступи (внизу).

## Як додати нову сторінку

1. `js/pages/mypage.js` → `Router.register('mypage', { render(root){...} })`
2. Рядок у `ACL.PAGES` з ролями
3. `<script>` в index.html + рядок в `ASSETS` у sw.js

Все. Меню, гард і доступи в адмінці з'являться самі.
