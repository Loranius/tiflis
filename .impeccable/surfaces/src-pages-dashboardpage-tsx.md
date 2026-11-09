---
version: 1
slug: "src-pages-dashboardpage-tsx"
primary_target: "src/pages/DashboardPage.tsx"
related_targets: ["src/pages/home-v3.css"]
---

# Головна / Сьогодні (src/pages/DashboardPage.tsx)

Scope: the home page ("Сьогодні"). Third screen of the portal redesign, inside the established world recorded in DESIGN.md (charcoal + gold classic dashboard, Golos Text). Visitor mode: Operate.

Audience and job: staff open it on a phone before, during and after a shift to see their shift, zone and duties, today's reservations (waiters), who works with them, and the nearest staff birthday; after 22:00 cash-handling roles enter the day's cash here. Shift hours (Kyiv): Р 12:00–22:00, СН 11:00–22:00.

Owner decisions: structure 2 «Стрічка дня» (day feed); the home must not look like a cheap module, so a big Tiflis wordmark sits on a gold masthead at the top; the team-faces strip from structure 3; a notice about the nearest staff birthday.

## Direction contract

THESIS: The day of one shift read as a single timeline under a gold restaurant sign; it refuses a grid of equal widget cards.

OWN-WORLD: Inherits DESIGN.md. The one exception is the masthead: a gold field carrying the charcoal wordmark, used only on this page as its signature. Elsewhere gold stays for now, the primary action and highlights.

STORY: Open the app → see the sign, the greeting and the shift card (how long until the start or the end) → glance at the team and the birthday → follow the feed down from the shift start to the shift end; after 22:00 close the shift with cash.

FIRST VIEWPORT: Gold masthead (wordmark, date and time, greeting) with the shift card overlapping its lower edge; the shift track and the team faces strip; the birthday notice; four pulse counters. On phones the masthead bleeds edge to edge and replaces the topbar. On screens 981px and wider the masthead spans two columns and the feed moves to the right column.

FORM: surface structure 2 of 3 «Стрічка дня», dealt; owner added the masthead sign and the faces strip. seed:ad94356bddb7e58d

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
