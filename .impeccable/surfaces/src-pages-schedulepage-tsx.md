---
version: 1
slug: "src-pages-schedulepage-tsx"
primary_target: "src/pages/SchedulePage.tsx"
related_targets: []
---

# Графік (src/pages/SchedulePage.tsx)

Scope: the monthly shift schedule. Second screen of the portal redesign, inside the established world recorded in DESIGN.md (charcoal + gold classic dashboard, Golos Text). Visitor mode: Operate.

Audience and job: staff on their phones check the whole team's month, who works today and tomorrow, and change their own shifts; administrators build the month's schedule from a phone. Shift codes (Р, Х, О, СН, Б, С, Р/Б, СН/Б, Д) and the per-department staff order must not change. Edit rights stay as they are: admins edit every row, staff edit only their own row.

Owner decision: on phones the month is split into two halves, 1–15 and 16–end, with a switch between them; opening the schedule in the current month selects the half that contains today (the 17th opens 16–end, the 3rd opens 1–15).

## Direction contract

THESIS: The paper schedule kept as a people × days table, made usable on a phone by halving the month and densifying the cells; it refuses the five-days-per-screen grid of tile buttons and the metric cards above it.

OWN-WORLD: Inherits DESIGN.md: charcoal surfaces, gold only for today, selection and the primary action; shift codes are tinted text cells (work in primary text, day off dimmed, leave in the loss red, breakfasts in gold tint, bar in a cool blue tint), Golos Text tabular figures, 14–20px radii.

STORY: The worker sees the half-month at a glance, finds today's column and their own pinned row, and taps a cell to change a shift; the admin paints shifts quickly with a code brush.

FIRST VIEWPORT: Tabs Команда / Мій графік sharing a row with the compact month switcher; the 1–15 · 16–кінець segmented control; a one-line summary (on shift today, my next shift); department chips; the table with the viewer's row highlighted in gold in its usual place (department order is never changed), today's column tinted gold and scrolled into view when off-screen, an on-shift count row under it. On screens 1024px and wider the whole month shows in one table and the half switch is hidden.

FORM: surface structure 2 of 3 (compact month table), dealt; owner added the half-month split. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
