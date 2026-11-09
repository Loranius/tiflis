---
version: 1
slug: "src-pages-menupage-tsx"
primary_target: "src/pages/MenuPage.tsx"
related_targets: ["src/pages/menu-v3.css", "supabase/functions/tiflis-menu-api/index.ts", "supabase/migrations/20261110000000_menu_learning.sql"]
---

# Меню (src/pages/MenuPage.tsx)

Scope: the restaurant menu page. Fourth screen of the portal redesign, inside the established world recorded in DESIGN.md (charcoal + gold classic dashboard, Golos Text). Visitor mode: Learn and Look up.

Audience and job: waiters learn the menu (new hires) and refresh it before or during a shift; on the floor they look up a dish to answer a guest — composition, how to offer it, what to pair it with, allergens. Chef and admin keep the content right.

Owner decisions: the menu is a learning tool and a reminder for waiters; modes are a flash-card trainer, a quick reference and a learning plan for newcomers; the dish card adds how to sell it, what to pair it with, allergens and what the name means / how to say it; Claude prepares draft texts that the kitchen reviews; the stop list is removed from this page.

## Direction contract

THESIS: The menu as a waiter's study guide — a calm reference list, a dish card that reads like a briefing, and flash cards with personal progress; it refuses the photo-gallery catalogue with metric cards and the stop-list controls.

OWN-WORLD: Inherits DESIGN.md. Gold only for the selected chip, the primary action («Перевірити себе», «Знаю», «Продовжити») and learning progress. Allergens use the loss coral tint because they are a warning. Draft content is flagged in a neutral note with a coral icon, never hidden.

STORY: Open the menu → Довідник with Кухня selected; search or tap a category → tap a dish → the card: what it is, composition, a line to say, pairing, allergens → «Знаю». To study: Тренажер → a topic → card → «Перевірити себе» → «Ще вчу» / «Знаю». План shows lessons in menu order and «Продовжити».

FIRST VIEWPORT: Segmented Довідник / Тренажер / План (+ «Позиція» for editors); search; section chips; category chips; the first category list of rows (photo or initials, name, two-line composition, price and weight). Admin also sees «Чернетки на перевірку: N».

FORM: surface roll dealt candidates 5, 2, 7 of the grounded list (lead: grouped reference list + briefing sheet; then flash-card deck; then numbered lesson path); the owner had already fixed the three modes, so all three dealt structures ship, one per mode. seed:a7e8ec49375b87e5

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
