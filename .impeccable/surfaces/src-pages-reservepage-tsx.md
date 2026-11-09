---
version: 1
slug: "src-pages-reservepage-tsx"
primary_target: "src/pages/ReservePage.tsx"
related_targets: ["src/pages/reserve-v3.css", "supabase/functions/tiflis-reserve-api/index.ts"]
---

# Резерви (src/pages/ReservePage.tsx)

Scope: the reservations page. Sixth screen of the portal redesign, inside the established world recorded in DESIGN.md. Visitor mode: Operate, mostly by the hostess on a phone.

Audience and job: the hostess takes most bookings by phone call and must write them down quickly and clearly while the guest talks; during service she seats arriving guests and marks no-shows / cancellations in one tap. Waiters and admins read the day.

Owner decisions: the module is for hostesses; bookings arrive by phone; during the evening she seats guests and marks no-shows / cancellations; the portal suggests free tables; occasion / wishes and menu pre-order are recorded.

## Direction contract

THESIS: The hostess desk — a day agenda grouped by time with one-tap arrival actions, and a booking form in the order of a phone call that suggests free tables; it refuses the metric tiles and the floor-first, field-first form of the old module.

OWN-WORLD: Inherits DESIGN.md. Gold for the primary action («Новий резерв», «Записати резерв») and the selected day, time slot, party size and table; booked tables on the floor wear the gold tint. A seated booking is the gain green (good outcome). Closed bookings are dimmed and tucked away. Danger delete is two-tap.

STORY: Phone rings → «Новий резерв» → Коли (pill) → О котрій (half-hour grid) → Скільки гостей (pill) → імʼя + телефон → pick a suggested free table (merge a neighbour if needed) → привід tags / pre-order → «Записати резерв». Evening: the agenda → «Прийшли» → later «Стіл звільнився»; «Інше» → «Не прийшли» / «Скасували». Схема залу shows one hall at a time.

FIRST VIEWPORT: Day strip with counts; day title and «N резервів · N гостей · N за столом»; full-width gold «Новий резерв» on phones; Список / Схема залу switch with search; hall chips; the first time group.

FORM: surface roll; the owner fixed the phone-call flow and free-table suggestions, so the dealt lead (time-grouped agenda + step form) ships, with the floor kept as the second view. seed:b438bb3413289ac2

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
