---
version: 1
slug: "src-pages-cashpage-tsx"
primary_target: "src/pages/CashPage.tsx"
related_targets: ["src/components/CashLeaderboard.tsx"]
---

# Каса (src/pages/CashPage.tsx)

Scope: the cash screen (payout, daily cash entry, half-month days, leaderboard). First surface of the portal redesign; its system later extends to the rest of the portal. Visitor mode: Operate.

Audience and job: a waiter or bartender on their own phone, mid-shift or at home. Enter today's cash and tips in seconds; see what they will be paid for the current half-month and why; see their place in the leaderboard. Admins also switch between workers.

Constraints: other people's sums are never shown to non-admins; payout formula, half-month periods, first_cash ranking and all API calls stay as they are. Dark ground is required (staff rejected light). Reference for craft: monobank.

## Direction contract

THESIS: The category-standard staff dashboard, played straight and finished to monobank's level: summary first, one primary action, data in clean cards. It refuses themed ornament and the old portal's stacked panels.

OWN-WORLD: Brand charcoal #2B2A29 family as the ground and raised surfaces, brand gold #D1B46B for the payout figure, the primary button, selection and the active tab; warm off-white text, two muted greys; green only for gains. One UI sans with tabular figures, large confident numbers, 14–16px radii, no gradients, glows or patterns. The supplied Tiflis wordmark in the header.

STORY: The worker sees their payout, understands it as 4% + shifts + adjustments, records today's cash, and checks their place.

FIRST VIEWPORT: Header with wordmark and the period segmented control (1–14 · 15–кінець · місяць). A 2×2 tile grid: До виплати (gold), Каса, Чайові, Місце в топі. Then the cash-by-day bar chart with today and the best day marked. The gold primary button «Внести касу за сьогодні» sits directly under the chart, reachable by thumb.

FORM: canon (category standard, user's choice), reference monobank. seed:c82bdca305ee554b

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
