# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Mobile-first installable PWA (`manifest.webmanifest`, `display: standalone`) served as static files with hash routing. Desktop layout exists and must keep working, but the phone is the primary device.

## Users

The staff of «Тифліс», a Georgian restaurant: waiters, bartenders, hostesses, runners, sommeliers, cooks and the head chef, plus administrators and a sysadmin. About 24 people have portal accounts; the wider team roster (birthdays) is about 48 people, most of whom never log in.

They use the portal on their own phones in two situations:

- **During a shift**, in short glances between guests or at the pass: check who works today, their own tasks, the stop list, reservations, and enter the day's cash.
- **Off shift**, at home: check next shifts and the month's schedule, their cash and payout, the rating, notifications and upcoming birthdays.

Administrators also build the schedule, manage staff, menus, reservations and broadcasts; this is less frequent, heavier work.

## Product Purpose

An internal operations portal that replaces scattered chats and paper for running the restaurant's floor and kitchen team. Success means a staff member opens it, finds their answer in seconds, and trusts the numbers they see, especially money and shifts.

## Positioning

Built for this one restaurant and its real working rules, not a generic HR or POS tool: the shift codes, roles and second roles, the cash formula and rating, the duty templates and handover notes are encoded exactly as the team works. Telegram is the team's notification channel, and the portal is the source of truth behind it.

## Operating Context

- Primary surfaces, by confirmed importance: **Каса і рекорди** (cash entry, payout, ratings) and **Графік** (monthly schedule), followed by **Сьогодні** (today's team, personal duties, shift handover), **Резерви**, **Меню і стоп-лист**, **Персонал** (profiles, birthdays) and **Управління** (admin).
- Phones, often one-handed, in a busy and sometimes dim restaurant; frequent short sessions rather than long ones.
- Telegram bot delivers password-reset codes, broadcasts, duty assignments and day-before birthday reminders; the portal links into the same accounts.
- Shift hours (owner, November 2026, Kyiv time): Р (work) 12:00–22:00; СН (breakfasts) 11:00–22:00. Cash is entered after the shift ends.
- Time and dates are Kyiv time (`Europe/Kyiv`). Interface language is Ukrainian.

## Capabilities and Constraints

- Stack is fixed by the existing codebase: React + TypeScript + Vite frontend, Supabase Auth/PostgreSQL/RLS, and JWT-protected Edge Functions per domain (`tiflis-*-api`). Hosted as a static site (GitHub Pages `stable-runtime`).
- Access is role-based and centralised in `src/lib/acl.ts`. Roles: sysadmin, admin, chef, cook, waiter, bar, hostess, runner, sommelier, trainee, staff; a person may hold a second role.
- **Cash and payout:** daily cash and tips per worker; payout per half-month (1–14, 15–end) = 4% of cash + 200 ₴ per worked day + adjustments with a short note. Tips are shown separately from pay.
- **Rating:** cash leaderboard for 1–14, 15–end, month and year, ranked only by the immutable `first_cash`; workers without cash in the period get no place. Staff rating from −100 to +100 with short comments. Accuracy/transparency of money and the motivation of the leaderboard matter equally.
- **Privacy rule:** regular staff see their own sums and their position in the leaderboard, never other people's amounts. Only admins see everyone's money.
  - **Owner exception (November 2026): Рекорди.** The records hall of fame and the per-category top‑5 show every waiter's record value, money included (best month / half-month cash, largest tip). The owner chose this for the competition; the live Каса · Топ stays position-only.
- **Schedule:** month grid by department, team view and personal "Мій рядок" view; admins edit everything, staff edit only their own row; optimistic saves with rollback.
- Birthday roster is independent of accounts; entries may be linked to a portal account.

## Brand Commitments

- Name: «Тифліс», written in the logo as **Tiflis** with the descriptor "restaurant". Georgian restaurant.
- **Logo (confirmed, supplied by the owner):** the Tiflis wordmark: flared, high-contrast stems, both i's dotted with a square diamond, a ligature-like "fl", and a lowercase "restaurant" line beneath. Files in `brand/`:
  - on a colour field: `tiflis-logo-gold-bg-white.png`, `tiflis-logo-gold-bg-charcoal.png`, `tiflis-logo-charcoal-bg-white.png`, `tiflis-logo-white-bg-gold.png`, `tiflis-logo-white-bg-charcoal.png` (2363×2363);
  - transparent: `tiflis-logo-white-transparent.png`, `tiflis-logo-black-transparent.png`, `tiflis-logo-gold-transparent.png` (1847×1176).
  Use the supplied files as-is; do not redraw, re-letter or recolour the wordmark beyond these variants. No vector (SVG/PDF) master has been supplied yet.
- **Brand colours (sampled from the supplied logo files):** gold `#D1B46B`, charcoal `#2B2A29`, white. These three are the only confirmed brand colours.
- The wordmark's typeface is not identified, and no brand text font has been supplied.
- The portal's current dark green, wine accent, Prata font and the Georgian letter თ in the app icon are the old portal's choices, not confirmed brand.
- **Interface style (chosen by the owner, November 2026):** a classic, category-standard dashboard look, played straight, with no themed ornament (no wine, menu, Georgian folklore or other motifs). Craft reference: **monobank**. Dark ground only; a light theme was explicitly rejected for evening use in the hall.
- Voice toward staff: Ukrainian, direct and informal-polite (the current copy addresses staff with "ти": «Введи свій робочий логін і пароль»).

## Evidence on Hand

- Real module behaviour and rules: `docs/*-v1.md` (schedule, cash, menu, reserve, staff, operations, admin).
- Live production data in Supabase (staff, schedule, cash, menu, reservations); never copy real employee names, amounts or guest data into design artefacts or mocks.
- No testimonials, metrics or external claims exist; none are needed for an internal tool and none may be invented.

## Product Principles

1. **Answer in a glance.** The most common question on each screen (my next shift, today's cash, my place) is answered without scrolling or tapping.
2. **Money is exact and private.** Every sum is correct, explained (formula, period, adjustments) and visible only to those allowed to see it.
3. **Motivation without exposure.** The leaderboard should feel like a real competition while revealing positions, not other people's earnings.
4. **The phone mid-shift is the default case.** Design for a thumb, a glance and poor light first; heavier admin work can take more room on larger screens.
5. **Encode the house rules, not generic ones.** Shift codes, roles, formulas and terminology follow how «Тифліс» actually works.

## Accessibility & Inclusion

No formal standard has been set. Practical needs follow from the operating context: legible text and sufficient contrast in dim light, comfortable touch targets for one-handed use, and no reliance on colour alone for shift types or statuses.
