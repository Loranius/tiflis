---
name: Tiflis Staff Portal
description: Internal operations portal for the staff of «Тифліс»; a classic dark dashboard in the restaurant's charcoal and gold.
colors:
  ground: "#161514"
  surface: "#201F1E"
  surface-2: "#2B2A29"
  surface-3: "#353432"
  line: "rgba(244, 238, 226, 0.08)"
  line-strong: "rgba(244, 238, 226, 0.16)"
  text: "#F4F0E8"
  text-2: "#ADA79C"
  text-3: "#A09A90"
  gold: "#D1B46B"
  gold-press: "#BFA25A"
  gold-tint: "rgba(209, 180, 107, 0.12)"
  gold-wash: "rgba(209, 180, 107, 0.07)"
  on-gold: "#1A1918"
  up: "#7DC593"
  down: "#E58B80"
  down-tint: "rgba(229, 139, 128, 0.14)"
  down-text: "#F2C1BA"
  bar: "#9FB4E8"
  bar-tint: "rgba(159, 180, 232, 0.14)"
typography:
  display:
    fontFamily: "Golos Text, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(40px, 11vw, 52px)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Golos Text, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "19px"
    fontWeight: 700
  title:
    fontFamily: "Golos Text, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 600
  body:
    fontFamily: "Golos Text, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    fontFeature: "tnum"
  label:
    fontFamily: "Golos Text, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  caption:
    fontFamily: "Golos Text, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.45
  micro:
    fontFamily: "Golos Text, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 400
rounded:
  s: "10px"
  m: "14px"
  l: "20px"
  segment: "12px"
  segment-thumb: "9px"
  dialog: "22px"
  pill: "999px"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  card-gap: "14px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    rounded: "{rounded.m}"
    padding: "0 20px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "#DCC07A"
  button-primary-active:
    backgroundColor: "{colors.gold-press}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.down}"
    rounded: "{rounded.m}"
    padding: "0 16px"
    height: "52px"
  button-danger-confirm:
    backgroundColor: "{colors.down}"
    textColor: "{colors.on-gold}"
  button-icon:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.circle}"
    size: "36px"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.gold}"
    padding: "8px 6px"
  segmented:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.segment}"
    padding: "3px"
  segmented-option:
    textColor: "{colors.text-2}"
    rounded: "{rounded.segment-thumb}"
    height: "34px"
  segmented-option-active:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text}"
  card-summary:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.l}"
    padding: "16px 16px 14px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.l}"
    padding: "16px"
  stat-tile:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.m}"
    padding: "12px"
  input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.m}"
    padding: "0 14px"
    height: "48px"
  input-money-hero:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.m}"
    height: "64px"
  select:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.s}"
    height: "40px"
  badge-you:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.dialog}"
    width: "min(100%, 480px)"
  alert:
    backgroundColor: "{colors.down-tint}"
    textColor: "{colors.down-text}"
    rounded: "{rounded.m}"
    padding: "12px 14px"
  button-toggle:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.segment}"
    padding: "0 14px"
    height: "42px"
  button-toggle-on:
    backgroundColor: "{colors.gold-tint}"
    textColor: "{colors.gold}"
  chip-department:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.s}"
    padding: "0 12px"
    height: "36px"
  chip-department-active:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text}"
  code-chip:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text}"
    rounded: "{rounded.segment-thumb}"
    padding: "0 7px"
    height: "26px"
  code-chip-leave:
    backgroundColor: "{colors.down-tint}"
    textColor: "{colors.down}"
  code-chip-breakfast:
    backgroundColor: "{colors.gold-tint}"
    textColor: "{colors.gold}"
  code-chip-bar:
    backgroundColor: "{colors.bar-tint}"
    textColor: "{colors.bar}"
  code-chip-mixed:
    backgroundColor: "{colors.bar-tint}"
    textColor: "{colors.text}"
  schedule-table:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.l}"
  schedule-cell:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.segment-thumb}"
    height: "32px"
  schedule-today:
    backgroundColor: "{colors.gold-wash}"
    textColor: "{colors.gold}"
  brush-palette:
    backgroundColor: "{colors.surface-3}"
    rounded: "{rounded.m}"
    padding: "8px"
  brush-code:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.segment-thumb}"
    height: "40px"
  brush-done:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    rounded: "{rounded.s}"
    padding: "0 14px"
  picker-option:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.segment}"
    padding: "8px 10px"
    height: "52px"
  dialog-picker:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.dialog}"
    padding: "18px"
    width: "min(100%, 420px)"
  home-masthead:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    rounded: "{rounded.dialog}"
    padding: "22px 20px 72px"
  home-masthead-wide:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    rounded: "{rounded.dialog}"
    padding: "28px 32px 80px"
  shift-card:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.l}"
    padding: "14px 16px 12px"
  team-face:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.circle}"
    size: "34px"
  notice-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.l}"
    padding: "12px 14px"
  pulse-counter:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.m}"
    padding: "10px 6px"
  close-shift-card:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.l}"
    padding: "16px"
  feed-now:
    textColor: "{colors.gold}"
  menu-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.m}"
    padding: "0 12px 0 14px"
    height: "48px"
  chip-section:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "44px"
  chip-section-active:
    backgroundColor: "{colors.gold-tint}"
    textColor: "{colors.gold}"
  chip-category:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "44px"
  chip-category-active:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text}"
  menu-list:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.l}"
  menu-row:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    padding: "10px 14px 10px 10px"
  menu-thumb:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text-3}"
    rounded: "{rounded.segment}"
    size: "56px"
  known-mark:
    textColor: "{colors.gold}"
    size: "14px"
  dish-sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.dialog}"
    padding: "18px"
    width: "min(100%, 560px)"
  draft-note:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.s}"
    padding: "10px 12px"
  sell-line:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.m}"
    padding: "12px 14px"
  allergen-chip:
    backgroundColor: "{colors.down-tint}"
    textColor: "{colors.down-text}"
    rounded: "{rounded.segment-thumb}"
    padding: "5px 10px"
  allergen-pick:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "44px"
  allergen-pick-on:
    backgroundColor: "{colors.down-tint}"
    textColor: "{colors.down-text}"
  flash-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.l}"
    padding: "16px 18px 18px"
  plan-hero:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.l}"
    padding: "18px"
  progress-track:
    backgroundColor: "{colors.surface-3}"
    rounded: "2px"
    height: "4px"
  progress-track-hero:
    backgroundColor: "{colors.surface-3}"
    rounded: "4px"
    height: "8px"
  progress-fill:
    backgroundColor: "{colors.gold}"
  lesson-number:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.circle}"
    size: "32px"
  lesson-number-complete:
    backgroundColor: "{colors.gold-tint}"
    textColor: "{colors.gold}"
  menu-editor:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.dialog}"
    padding: "18px"
    width: "min(100%, 640px)"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.m}"
    padding: "0 18px"
    height: "52px"
  button-primary-compact:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    rounded: "{rounded.m}"
    padding: "0 14px"
    height: "44px"
  chip-group:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "44px"
  chip-group-active:
    backgroundColor: "{colors.gold-tint}"
    textColor: "{colors.gold}"
  face-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.l}"
    padding: "0 0 10px"
  face-tile-hover:
    backgroundColor: "{colors.surface-2}"
  face-portrait:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text-3}"
  profile-sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.dialog}"
    padding: "18px"
    width: "min(100%, 480px)"
  profile-credo:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.m}"
    padding: "12px 14px"
  profile-facts:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.m}"
    padding: "12px 14px"
  contact-pill:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "44px"
  sheet-error:
    backgroundColor: "{colors.down-tint}"
    textColor: "{colors.down-text}"
    rounded: "{rounded.s}"
    padding: "10px 12px"
  profile-editor:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.dialog}"
    padding: "18px"
    width: "min(100%, 600px)"
  editor-portrait:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text-3}"
    rounded: "{rounded.circle}"
    size: "88px"
  credential-sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.dialog}"
    padding: "22px 18px 18px"
    width: "min(100%, 480px)"
  birthday-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.l}"
    padding: "10px 12px"
    height: "76px"
  birthday-row-soon:
    backgroundColor: "{colors.surface-2}"
  birthday-photo:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text-3}"
    rounded: "{rounded.circle}"
    size: "56px"
  day-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.m}"
    width: "56px"
    height: "64px"
  day-chip-selected:
    backgroundColor: "{colors.gold-tint}"
    textColor: "{colors.gold}"
  booking-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.l}"
    padding: "12px 14px 10px"
  booking-tag:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text}"
    rounded: "{rounded.segment-thumb}"
    padding: "3px 9px"
  booking-state:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.segment-thumb}"
    padding: "3px 9px"
  booking-state-seated:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.up}"
  booking-action:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.segment}"
    padding: "0 14px"
    height: "44px"
  booking-action-arrive:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text}"
  booking-action-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
  floor-table:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text}"
    rounded: "{rounded.segment}"
    padding: "4px 6px"
    width: "52px"
    height: "48px"
  floor-table-booked:
    backgroundColor: "{colors.gold-tint}"
    textColor: "{colors.gold}"
  floor-table-seated:
    backgroundColor: "color-mix(in srgb, #7DC593 22%, #201F1E)"
    textColor: "{colors.text}"
  form-pill:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.segment}"
    padding: "0 14px"
    height: "44px"
  form-pill-on:
    backgroundColor: "{colors.gold-tint}"
    textColor: "{colors.gold}"
  table-suggestion:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.m}"
    padding: "8px 12px"
    height: "60px"
  table-suggestion-on:
    backgroundColor: "{colors.gold-tint}"
    textColor: "{colors.gold}"
  merge-row:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.m}"
    padding: "12px 14px"
  reservation-form:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.dialog}"
    padding: "18px"
    width: "min(100%, 600px)"
  record-plaque:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.l}"
    padding: "16px"
  record-avatar:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text-3}"
    rounded: "{rounded.circle}"
    size: "56px"
  record-own-place:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.s}"
    padding: "10px 12px"
  badge-you-tint:
    backgroundColor: "{colors.gold-tint}"
    textColor: "{colors.gold}"
    rounded: "7px"
    padding: "1px 7px"
  badge-record:
    backgroundColor: "{colors.gold-tint}"
    textColor: "{colors.gold}"
    rounded: "{rounded.segment-thumb}"
    padding: "4px 10px"
  record-list:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.l}"
  record-row:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    padding: "14px 16px"
  button-record-edit:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.segment}"
    padding: "0 12px"
    height: "40px"
  record-person:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.l}"
    padding: "16px"
  record-select:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.m}"
    padding: "0 12px"
    height: "44px"
  race-link:
    backgroundColor: "transparent"
    textColor: "{colors.gold}"
    padding: "0 4px"
    height: "44px"
  record-editor:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.dialog}"
    padding: "18px"
    width: "min(100%, 480px)"
---

# Design System: Tiflis Staff Portal

## Overview

**Creative North Star: "The Night-Shift Ledger"**

A category-standard staff dashboard played straight and finished to banking-app craft (the owner's reference is monobank). The worker's money comes first: one large gold figure, its formula spelled out beneath it, one primary action, then data in calm cards. Everything sits on a warm charcoal ground taken from the supplied Tiflis logo, tuned for a phone held in one hand in a dim restaurant hall. The ground is dark only: the owner rejected a light theme for evening use.

The system carries no themed ornament: no wine, menu, Georgian folklore or other motifs, and no gradients, glows or patterns. Character comes from the brand pair (charcoal and gold), confident tabular numbers in one sans, tonal surface steps, and generous 14–20px radii. Gold is scarce and always means something: your money, your learning progress, your action, your current selection.

**Migration state.** The cash screen (`src/pages/CashPage.tsx`, `src/components/CashTopList.tsx`, styles in `src/pages/cash-v3.css`) was the first screen built on this system. The schedule screen (`src/pages/SchedulePage.tsx`, styles in `src/pages/schedule-v3.css`) is the second. The home page («Сьогодні», `src/pages/DashboardPage.tsx`, styles in `src/pages/home-v3.css`) is the third, and it carries the system's one page-scoped exception: the gold masthead (see The Gold Is Earned Rule). The menu («Меню ресторану», `src/pages/MenuPage.tsx`, styles in `src/pages/menu-v3.css`) is the fourth: a study guide for waiters in three modes, Довідник / Тренажер / План, switched by a three-segment radiogroup segmented control. Its teaching fields and per-person progress come from the `menu_learning` migration and the `tiflis-menu-api` edge function. Personnel («Персонал», `src/pages/StaffPage.tsx` and `src/pages/StaffBirthdaysTab.tsx`, styles in `src/pages/staff-v3.css` and `src/pages/staff-birthdays.css`) is the fifth: «хто є хто» as a wall of faces grouped by role, with a two-segment Команда / Дні народження switch and, for admins, a gold «Новий працівник» button beside it. Its data and account actions come from the `tiflis-staff-api` edge function. Reservations («Резерви», `src/pages/ReservePage.tsx`, styles in `src/pages/reserve-v3.css`) is the sixth: the hostess desk, a day strip over a time-grouped agenda with one-tap arrival actions, a «Схема залу» floor view of one hall at a time, and a booking form in the order of a phone call that suggests free tables. Its data, availability and status changes come from the `tiflis-reserve-api` edge function. Records («Рекорди», `src/pages/RecordsPage.tsx`, styles in `src/pages/records-v3.css`) is the seventh: a hall of fame for waiters, switched by a two-segment Дошка слави / Мої рекорди control, with a gold «Хто лідирує цього місяця — у Касі» link and a chevron beside it that deep-links to the live race at `/cash?tab=top` (Каса opens on its Топ каси tab from that query). The Дошка слави is one plaque per record with the holder large and places 2–5 beneath; Мої рекорди turns every record into a place and a distance («до рекорду …»), and waiters enter their own manual records (largest tip, plates at once, tables at once). Its data comes from the `records_*` actions of the `tiflis-secure-api` edge function. The portal tokens (`--t-*`) live in `src/theme/tiflis-theme.css`, which loads last and also rethemes the shared shell (sidebar, top bar, mobile bottom nav, avatars). Every other screen still carries legacy styles: hard-coded greens from the old portal, Prata headings, and older panel patterns. As a bridge, the legacy token names (`--bg`, `--surface`, `--surface-2`, `--surface-3`, `--surface-raised`, `--border`, `--border-strong`, `--text`, `--muted`, `--gold`, `--gold-soft`, `--green`, `--danger`) now resolve to the `--t-*` values, so older screens get the brand ground without being redesigned. The bridge is temporary. When you migrate a screen, use the `--t-*` tokens and the cash-v3 component patterns below, and remove its hard-coded colours and Prata. Don't add new uses of the legacy names.

**Key Characteristics:**
- Warm charcoal ground with three tonal surface steps; depth comes from tone, not shadow.
- Brand gold (#D1B46B) used sparingly, only for meaning.
- One self-hosted UI sans (Golos Text, 400–700), tabular figures everywhere money appears.
- Summary first, one gold primary action per view, data in rounded cards.
- Phone-first single column, which becomes a two-column dashboard at 1024px (Home splits at 981px).
- One page-scoped exception: the Home masthead is a flat gold field carrying the charcoal wordmark. Gold is a background nowhere else.
- Green and red only for gain and loss, always paired with an arrow or sign.
- Dense team data stays a people × days table; today and the viewer are marked in place with a faint gold haze, never reordered.
- Reference content (the menu) reads in one left-aligned 880px column in line with the page title; allergens are a coral warning, and the viewer's own learning progress is gold.
- People are faces first: the team is a wall of square portraits grouped in hall order, each opening a profile sheet; account state is quiet admin-only text, never a badge.
- The hostess desk reads the day by time: bookings are cards under their time, arrival is one tap, a seated table is gain green, and the phone-call form proposes free tables instead of asking for one.
- Records are a hall of fame, not a second race: one plaque per record with the holder large, a gold trophy beside the holder, tied values sharing a place, and a personal view that reads each record as a place and a distance. The live monthly race stays on Каса · Топ.

## Colors

A warm near-black ramp built around the logo's charcoal, a single brand gold, and two signal colours kept for movement.

### Primary
- **Tiflis Gold** (gold): the brand gold sampled from the supplied logo. Used for the payout figure, the primary button, the active tab underline, the "today" chart label and baseline, the best-day bar, podium ranks (1–3), the "Ти" badge, text links, the keyboard focus ring, the input caret, the active mobile-nav item, and active sidebar icons. On Home it is also the masthead field (the one exception to The Gold Is Earned Rule), the shift countdown, and the now marker on the shift track and in the day feed. On the menu it marks the viewer's own learning: the «знаю» check after a dish name, the fill of every progress bar, the check in a completed lesson's disc, and the border and label of the selected section chip. On Personnel it is only the primary action («Новий працівник», «Зберегти», «Створити акаунт», «Скопіювати дані»), the border and label of the selected group chip, and the viewer's own face tile (an inset gold hairline and «Це ти» in gold). On Reservations it is the primary action («Новий резерв», «Записати резерв», «Зберегти», «Резерв на цей стіл»), the border, figures and count of the selected day chip, the dot of today's chip when it is selected, the border and label of the selected hall chip, form pill, time slot and suggested table, and the border and time of a booked table on the floor (see The Gold Is Earned Rule). On Records it is the record-holder trophy, the viewer (the «Ти» pill, the viewer's own name and rank in a plaque, and the place figure in «Твоє місце N»), the «Рекорд ресторану» badge, the primary «Зберегти» in the record editor, the «Хто лідирує цього місяця — у Касі» race link, and the editor's input caret and focus border.
- **Pressed Gold** (gold-press): pressed state of gold buttons only.
- **Gold Wash** (gold-tint): a quiet 12% gold field that marks *you* in a list (the highlighted ranking row) and the active mobile-nav item. On the menu it fills the selected section chip and a completed lesson's number disc; on Personnel, the selected group chip. On Reservations it fills the selected day chip, hall chip, form pill, time slot and suggested table, and a booked table on the floor. On Records it fills the «Ти» pill and the «Рекорд ресторану» badge. Selection highlight uses the same gold at 35%.
- **Gold Haze** (gold-wash): a fainter 7% gold field for marks that span a whole table column or row: today's column and the viewer's own row in the schedule, and today's row in the day list. It is faint enough to cross code tints without fighting them.
- **Ink on Gold** (on-gold): text and icons placed on gold, including the date, time and greeting on the Home masthead, and on the confirmed-delete red.

### Neutral
- **Night Ground** (ground): page background, `theme-color`, and the boot screen.
- **Charcoal Surface** (surface): standard cards, stat tiles, dialog body, desktop sidebar.
- **Brand Charcoal** (surface-2): the logo's charcoal. Used for the hero summary card (payout or place), the segmented-control track, inputs, the select, icon buttons, and the estimate panel inside the dialog. On the menu it carries the quoted «Як запропонувати гостю» block and the draft note. On Personnel it carries the profile credo, the facts list, the credential values, the secondary buttons, and the coming week's rows in the birthday roster. On Reservations it carries the booking action buttons, the form's pills, time slots, fields and suggested-table tiles, the merge row, the table sheet's booking list, and the round close buttons. On Records it carries the «Твоє місце N» note in a plaque, the «Внести» / «Оновити» buttons, the person select, the editor's fields and its round close button.
- **Raised Charcoal** (surface-3): the active segment thumb, avatar discs, the chart zero-line, and icon-button hover. On the menu: dish thumbs and initials bands, lesson number discs, progress-bar tracks, and the selected category chip. On Personnel: the portrait field behind initials (wall tiles, profile band, editor disc and roster photos). On Reservations: occasion tags and the state pill on a booking card, the full-width «Прийшли» button, and a free table on the floor.
- **Hairline** (line) and **Strong Hairline** (line-strong): warm off-white at 8% and 16%. Use line for card borders and list dividers, line-strong for input, select and dialog borders and the mobile-nav edge.
- **Warm Paper** (text): primary text and figures.
- **Muted Stone** (text-2) and **Quiet Stone** (text-3): secondary and tertiary text (labels, meta, captions). The two are close in value. text-2 carries labels that must read; text-3 carries metadata and inactive tabs.

### Tertiary (signal)
- **Gain Green** (up): positive rank movement, the "+N ₴ до виплати" line on records, and, on Reservations only, a seated booking: the «За столом» state pill (green text with a check) and the seated table on the floor (22% gain green mixed into charcoal surface, labelled «за столом»). Nothing else.
- **Loss Coral** (down): negative movement, destructive actions, and error states. Alert and error text use Coral Text (down-text), a lighter coral that stays legible on the wash; the cash alert sits on a 12% coral wash and the schedule alert on Coral Wash (down-tint).
- **Coral Wash** (down-tint): the 14% coral field behind the schedule's load-failure alert, the leave code, and the menu's allergen chips (see The Allergen Warning Rule).
- **Coral Text** (down-text): alert and form-error text on a coral wash, on the cash, schedule, menu and personnel screens, and the allergen names on their chips. On Personnel an action error sits on coral wash inside the open profile sheet. On Reservations a failed status tap reports on coral wash inside the tapped booking card, and form problems are coral text in the form's sticky footer. On Records a load failure is a coral-wash alert with a «Спробувати ще раз» action, and the record editor's validation and save errors sit in a coral-wash note inside the dialog.

### Shift-code palette
A closed categorical legend used only for schedule shift codes. The letter code always carries the meaning; colour only groups.
- **Work** (Р): text colour, no tint. **Day off** (Х): text-3 at weight 500. **Neutral** (С, and an unassigned cell): text-2.
- **Leave** (О): loss coral on coral wash.
- **Breakfasts** (СН): gold on gold wash.
- **Cool Bar** (bar) on **Bar Wash** (bar-tint): the bar shift (Б). Mixed codes (Р/Б, СН/Б) set text colour on the bar wash. The cool blue exists only for this and appears nowhere else in the portal.

### Named Rules
**The Gold Is Earned Rule.** Gold marks money that belongs to the viewer, the viewer's own learning progress (the «знаю» mark, progress bars and completed lessons on the menu), the viewer themself in a list of people (the «Ти» badge, the gold ring in the team strip, and «Це ти» with an inset gold hairline on their own face tile), the one primary action, or the current selection. It is never a background wash for a section, a decorative border, or a heading colour. The one exception is the Home masthead: on the home page only, a flat gold (#D1B46B) field carries the charcoal wordmark, the date and time, and the greeting, with all text in ink on gold (`--t-on-gold`). It stays flat (no gradient, tint, texture or shadow), and no other page, section or card may use gold as its background. Reservations adds one state use, scoped to the «Схема залу» floor tiles: a table with a live booking (waiting, not yet seated) wears a 1px gold border, the 12% gold wash and its booking time in gold. It marks a single table tile, never a card, section or list row, and it is never the solid gold fill. Everywhere else on that page gold keeps the meanings above: the primary action and the current selection. Records adds one meaning, scoped to that page: a 14px gold trophy beside the name of whoever holds a restaurant record, and the «Рекорд ресторану» badge (gold on the gold wash, with the trophy) when the person being viewed holds it. Everything else gold on Records is the viewer (the «Ти» pill, the viewer's own name and rank, the place figure in «Твоє місце N»), the one primary action («Зберегти»), or the text link to the live race. Places 2–5 carry no podium or medal colours.

**The Green Means Gain Rule.** Green and coral appear only for movement and consequence (gain, loss, delete, error) and always with an arrow, sign or word next to them. Green is never a brand or success-decoration colour. This rule retires the old green-era palette. The one outcome use is a seated booking on Reservations: guests who arrived are the good outcome, so the «За столом» state pill is gain green text with a check, and the seated floor tile is a 22% gain-green mix into charcoal surface with «за столом» written on it. Waiting, closed, cancelled and no-show bookings carry no green, and green never becomes a button or a success toast.

**The Allergen Warning Rule.** Allergens are a warning, so they wear the loss coral tint: each allergen is named in words in coral text on coral wash, under an «Алергени» heading, in the dish sheet, the trainer answer and the editor's picked allergens. The draft flag uses the same warning sense as a small coral alert icon on a neutral note. This is coral's one warning use beyond movement and consequence. It is not a category and not decoration, and it does not change what green may do (see The Green Means Gain Rule).

**The Closed Legend Rule.** Shift-code colours are a closed legend: every coloured code shows its letters, and the screen shows the legend. Inside that legend, gold on gold wash means breakfasts and coral on coral wash means leave; this is the only place gold and coral carry a category instead of the meanings above. Never borrow the code tints, or the cool bar blue, for anything else. Coral wash is not the legend's property: outside it, it keeps its warning sense for alerts and allergens (see The Allergen Warning Rule).

## Typography

**Display Font:** Golos Text (with system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** Golos Text
**Label/Mono Font:** none distinct; figures use Golos Text with `font-variant-numeric: tabular-nums`

**Character:** One sturdy, Cyrillic-native UI sans at four weights (400, 500, 600, 700), self-hosted via @fontsource. Hierarchy comes from size and weight, not from a second face.

### Hierarchy
- **Display** (700, clamp 40–52px, 1.02, −0.02em): the hero money figure only, in gold for payout and in text colour for rank. The currency sign or "з N" suffix drops to half size at 600 (rank suffix 18px/500 in text-2).
- **Headline** (700, 19px): dialog titles, with the first letter capitalised. The shell page title in the top bar is also Golos Text 700 at −0.01em.
- **Title** (600, 16px): card titles and the section tabs (Огляд / Топ каси).
- **Body** (500–700, 15px): list primary lines, breakdown values (600), and record sums (700). Stat tile values are 17px/700.
- **Label** (500–600, 14px): segmented options, links, select, empty-state copy (14px/1.5 in text-2), and alerts. Field labels are 13px in text-2.
- **Caption** (400, 12–12.5px, 1.45): breakdown terms, card meta, record sub-lines, notes, and the privacy line, in text-3.
- **Micro** (11–11.5px): chart day numbers, the average tag, the "Ти" badge (700), and stat sub-lines.
- **Masthead** (Home only, 700, in ink on gold): the greeting at clamp 23–30px, 1.15, −0.01em, with balanced wrapping. The date is 13px/600 over the Kyiv time at 700; at ≥981px the date grows to 15px and the time to 40px at −0.02em, tabular.
- **Menu** (Golos throughout): group headings 16px/700 with a 12.5px text-3 count; row names 15px/600 over a two-line 13px/1.4 composition in text-2; price 15px/700 over weight 12.5px in text-3. The dish sheet title is 23px/700 (the flash-card title 24px/700, 1.2), its price 19px, and its block headings 12.5px/600 in text-3 over 15px/1.55 body; the «Як запропонувати гостю» quote is 16px. The plan figure is 40px/700 at −0.02em in text colour over a 15px text-2 line.
- **Personnel** (Golos throughout): group headings 16px/700 with a 12.5px/500 text-3 count; on a face tile the name is 15px/600 (1.25) over the nick or role at 13px in text-2, one line with an ellipsis («Це ти» at 600 in gold); portrait initials 34px/700 on the wall, 64px in the profile photo field (36px in the empty band) and 28px in the editor disc. The profile name is 23px/700 (1.2) over a 15px text-2 role line; the credo is 15px/1.5; facts are 14px text-2 terms against 14px/600 values; the admin note is 13px text-3 with the login in text-2 at 600. Editor and credential titles are 19px/700; the credential values are 19px/700 at 0.02em, selectable as a whole. Roster names are 15px/600 over a 13px text-2 position, then the date at 13.5px/600 and the countdown at 13px in text-3 (text at 600 in the coming week).
- **Reservations** (Golos throughout, tabular): day chips stack an 11px text-3 weekday over the 18px/700 date and an 11px/700 count; the day title is 23px/700 (1.2) over a 14px text-2 summary. In the agenda the time column is 17px/700; on a card the guest name is 16px/700 (1.3), the party size 19px/700 with its noun at 13px/500 in text-2, the «Стіл … · зал · до HH:MM» line 13.5px in text-2, tags and the state pill 12.5px (600 and 700), notes 14px/1.45 with «Меню:» in text-3, and action labels 14px/600 («Прийшли» 700). Floor tiles carry the label at 15px/700 over 11.5px seats or time. In the form, step legends are 14px/700, field labels 13px/600 in text-2, pills 14.5px/600 (party sizes 17px/700), time slots 15px/600 (700 when selected), and suggested tables 17px/700 over a 12.5px text-2 «зал · N м.» line.
- **Records** (Golos throughout, tabular): the plaque's category title is 15px/700 in text-2; the holder's value is a 30px/700 figure at −0.02em in text colour followed by its unit at 15px in text-2 (₴, or a declined noun: тарілка, столики, змін); the holder's name is 15px/600 after the trophy, over the period at 13px in text-3. Places 2–5 are 14px rows: the rank at 700 in text-3, the name, and the value at 600. «Твоє місце N» is 14px text-2 with the place at 700 in gold. In Мої рекорди the category title is 14px/600 in text-2, the value a 22px/700 figure with its unit at 14px in text-2, «when» at 13px in text-3; on the right «N місце з M» is 13.5px text-2 with N at 17px/700, the gap line («до рекорду …», «рекорд — …») 13px in text-3, and the badge 12.5px/700. The person header name is 21px/700 over a 14px text-2 «Серед N офіціантів». The «Ти» pill is 12px/700. In the record editor the title is 19px/700, the hint 14px/1.45 in text-2, field labels 13px/600 in text-2, and the hero input a 30px/700 figure.
- **Codes** (700, 12.5px in table cells, 11px with −0.01em for three-letter codes, 13px in chips, 14px in the brush palette, 11.5px in the legend): shift codes. The table head stacks a 10.5px weekday in text-3 over a 13px/700 day number; names in the sticky column are 13px/500 (14px at ≥1024px).

### Named Rules
**The Tabular Money Rule.** Every screen showing sums sets `tabular-nums`. Amounts are formatted uk-UA (space-grouped thousands) with a trailing ₴, so columns of money line up.

**The One Face Rule.** Golos Text is the only interface face. Prata and system display faces belong to the legacy screens and are removed during migration.

## Layout

Phone first. The cash screen is a single column, max 1120px wide and centred, with a 12px vertical rhythm between blocks. Cards pad 16px with a 14px internal gap. Stat tiles and the payout breakdown are three equal columns with an 8px gap. Lists are full-bleed rows (12px or 10px vertical padding) separated by hairlines rather than boxed items.

Order on the phone follows the thumb: a header row with tabs and the month switcher, the period segmented control, the hero summary card, the stat tiles, then the gold primary button above the chart, so it can be reached before the fixed bottom navigation. Records or the ranking come after that.

- **< 640px:** dialogs are centred by the shared ModalRuntime (`src/modal-runtime.css`), which applies to every dialog in the portal.
- **640px:** dialog padding grows to 22px.
- **≤ 980px:** the shell switches to the mobile top bar (wordmark 68px with a line-strong divider before the page title) and the floating bottom navigation.
- **Schedule (phone):** max 1400px wide, 12px rhythm. The month is split into two halves (1–15, 16–end) with a segmented switch that opens on the half containing today. The table scrolls sideways inside its card behind a sticky 92px name column; cells are at least 31px wide and 38px tall, and today's column scrolls into view when it is off-screen. While the admin brush is open it is fixed 96px above the bottom navigation, inset 12px from each side, and the page gains 132px of bottom padding so the last rows stay reachable.
- **≥ 1024px (schedule):** the whole month shows in one table and the half switch is hidden. The name column grows to 124px, cells shrink to 26px minimum, the gap grows to 16px, and the brush docks bottom-right (560px wide, 24px from the bottom, 32px from the right) with 120px of page padding.
- **Home (phone, ≤ 980px):** the shell top bar is hidden on this page and Home owns its side gutters (12px, or the safe-area inset when larger), so the gold masthead bleeds to both screen edges and up under the status bar (18px plus the top safe-area inset). Only its bottom corners are rounded. Its 72px bottom padding makes room for the shift card, which overlaps it by 60px with a 6px inset. Below that is one 12px-rhythm column: shift card, birthday notice, pulse counters, alert, close-shift card, day feed, tomorrow card.
- **≥ 981px (Home):** a two-column grid (1fr : 1fr, 24px column gap, max 1120px). The masthead is a banner across both columns (28/32/80px padding, wordmark 190px), and the time at 40px holds its right side. The shift card overlaps the banner by 64px, inset 24px from the left. The left column stacks the shift card, birthday notice, pulse counters, alert, close-shift and tomorrow cards, each with 12px below it so an absent card leaves no gap. The day feed sits in the right column, spanning every row, and a final 1fr row absorbs its extra height so the left column stays packed at the top. Home splits at the shell's 981px, not at the 1024px dashboard breakpoint.
- **Menu (phone):** one column with a 14px rhythm: the mode switch (capped at 420px, with the editors' outlined «Позиція» button beside it), search, section chips, category chips, the editors' draft link, then the grouped list. Section and category chips scroll sideways in one row each, without a scrollbar, and their right edge fades out over the last 28px (a mask, so the row reads as scrollable).
- **≥ 981px (Menu):** the page stays one reading column, max-width 880px, left-aligned in line with the page title rather than centred. Chip rows wrap instead of scrolling, so no category hides; list rows pad 12/18/12/12px and thumbs grow from 56px to 64px. The dish sheet is centred at up to 560px and the editor at up to 640px.
- **Personnel (phone):** one column with a 14px rhythm, max 1120px and left-aligned: the switch row (segmented control capped at 420px, with the admins' compact gold «Новий працівник» beside it, wrapping below when there is no room), search (48px, capped at 560px), group chips, then the groups. Below 981px the chip row scrolls sideways behind the same 28px right-edge fade as the menu. Each group stacks its heading over the wall with a 10px gap. The wall is an auto-fill grid of tiles at least 136px wide with a 12px gap, fixed at two equal columns at 560px and narrower. The birthday roster is an auto-fill grid of 300px-minimum rows with an 8px gap, one column at 560px and narrower, where the position filter and the admins' «Додати людину» take full rows.
- **≥ 981px (Personnel):** chips wrap instead of scrolling and wall tiles grow to a 156px minimum. The profile sheet is centred at up to 480px; the editors are centred at up to 600px, and their two-column forms collapse to one column at 560px and narrower.
- **Reservations (phone):** one column with a 14px rhythm, max 880px and left-aligned like the menu: the day strip, the day head, the tools row (the Список / Схема залу switch, up to 280px, beside a 44px search that wraps under it), the hall chips, then the agenda or the floor. The day strip always scrolls sideways behind the 28px right-edge fade, at every width; the hall chips do so below 981px. At 560px and narrower the gold «Новий резерв» spans the column, the agenda's time sits above its cards instead of in a 56px column, and the form's two-up fields stack. Time groups sit 14px apart, with 8px between cards.
- **≥ 981px (Reservations):** hall chips wrap; the agenda keeps its 56px time column with a 10px gap; «Новий резерв» sits at its natural width at the right of the day head. The table sheet is centred at up to 520px and the form at up to 600px, each capped to the viewport height less 48px and scrolling inside.
- **Records (all widths):** one column with a 14px rhythm, max 1120px and left-aligned: the top row (the Дошка слави / Мої рекорди switch, flexible from 260px up to 420px, with the gold race link after it; the link wraps under the switch on phones and sits at the far right on wide screens), then the board or the personal view. The board is an auto-fill grid of plaques at least 320px wide with a 12px gap, packed `dense` and top-aligned, so a short plaque (a record with one holder and no places) never stretches to its neighbour's height; at 560px and narrower it is one column. Мої рекорди stacks the person header over one hairline-separated list card with a 12px gap. At 560px and narrower the admin select takes a full row and record rows top-align their two sides. While loading, three 220px pulsing blocks hold an auto-fill grid of 280px minimum. The record editor is centred at up to 480px, capped to the viewport height less 48px.
- **≥ 1024px:** the overall gap grows to 20px. The overview becomes a two-column grid (1.25fr : 1fr), with payout, stats, action and chart on the left and records spanning the right. The top view splits 1fr : 1.4fr. Segmented controls cap at 420px (three options) or 520px (four). The hero card pads 22px and the chart grows from 132px to 176px tall.

## Elevation & Depth

The system is flat and tonal. Depth is a step up the ground → surface → surface-2 → surface-3 ramp, plus hairline borders. The only in-content shadow is the small one under the active segment thumb. Overlays use a dark scrim (rgba(8, 8, 7, 0.62)). The top bar uses a translucent ground (88%) with a 16px backdrop blur, and the mobile nav uses translucent surface (96%). The schedule's floating brush palette follows the same rule: it sits on raised charcoal with a strong hairline and no shadow, and the shift picker uses the same scrim. On Home the masthead is flat gold, and the shift card lifts off it by overlap, brand charcoal and a strong hairline, with no shadow. The viewer's face in the team strip carries a 1.5px inset gold ring, which marks selection, not depth. On Personnel the viewer's face tile carries a 1px inset gold hairline for the same reason, face tiles step from charcoal surface to brand charcoal on hover or press, and the coming week in the birthday roster lifts one step to brand charcoal with a strong hairline. None of them casts a shadow. Reservations stays flat too: booking cards are charcoal surface without a border, the «Прийшли» button lifts one step to raised charcoal, the floor is a charcoal-surface canvas with tiles on raised charcoal, and the form's sticky header and footer stay on charcoal surface, the footer divided by a hairline, with no shadow. Its view switch reuses the segment-thumb shadow. Records is flat as well: plaques, the person header and the record list sit on charcoal surface with no border, the «Твоє місце N» note steps one up to brand charcoal, and only the switch's thumb carries the segment-thumb shadow.

### Shadow Vocabulary
- **Segment thumb** (`box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35)`): only on the selected option of a segmented control, to lift it off the track.

### Named Rules
**The Tone Not Shadow Rule.** To raise something, move it one step up the surface ramp. Don't add a drop shadow, glow or gradient. The summary card sits on brand charcoal, while ordinary cards sit one step lower with a hairline border.

## Motion

Motion is expressive at the rare moments and quick at the everyday ones. It is built on Motion (`motion/react`, loaded once through `LazyMotion` with `domMax` in `src/lib/motion.tsx`) plus a few CSS effects in `src/motion.css`. Timing lives in code, never in page stylesheets.

- **Springs:** `settle` (0.42s, no bounce) moves screens, cards and sheets; `glide` (0.38s, 0.12 bounce) moves the shared nav pill, segment thumbs and tab lines; `pop` (0.55s, 0.42 bounce) is for celebrations only. Eased tweens use `cubic-bezier(0.23, 1, 0.32, 1)` out and the logo wipe uses `cubic-bezier(0.77, 0, 0.175, 1)`.
- **Screen change:** the incoming screen rises from 18px along the direction of travel (forward right, back left), from 0 opacity and a 6px blur; the top-bar title follows with 6px and a 4px blur. There is no exit animation, so the next screen is never delayed.
- **Shared elements:** the gold wash under the active bottom-nav tab, the raised thumb of every segmented control and the gold underline of tab rows are one element each that glides to the new choice (`layoutId`), never a cross-fade.
- **Dialogs:** every sheet opened through `Overlay` (and the «Ще» sheet) rises 28px out of a 6px blur at 0.97 scale over 420ms while the scrim fades in over 220ms. Because the shared modal CSS pins `transform` on phones, this runs on the independent `translate` / `scale` properties through the Web Animations API. The «Ще» sheet has a grab strip and closes on a downward swipe past 90px or a fast flick, otherwise it springs back.
- **Home:** the first visit of a session plays the entrance once: the wordmark is wiped in left to right out of a blur, the date rises, the greeting arrives word by word, then cards cascade 50ms apart. Later visits only get the screen change. On scroll, the masthead content drifts down at 0.3× the page, fades to 20% and shrinks to 0.94 under the shift card (parallax). The shift track fills from the left on load and the «now» mark pops in.
- **Celebrations:** when a birthday is today, light sweeps the notice once, the cake wobbles and gold confetti bursts once per day. On Records, plaques and rows rise into view as you scroll (once each), record values roll up, the holder's trophy pops and the «Рекорд ресторану» badge gets the sweep, plus confetti once a day when the record is yours.
- **Numbers:** «До виплати» on Cash and record values roll up to their value (0.7s) and roll between values when the period changes; the screen reader always gets the final number. Cash-top rows slide to their new places when the ranking changes.

### Named Rules
**The Once Rule.** Expressive motion (the logo wipe, the Home cascade, confetti) plays once per session or once per day, keyed in browser storage, so the tenth visit of a shift is calm.

**The Still Rule.** Under «reduce motion» nothing decorative moves: no entrance, blur, wipe, parallax, sheen, confetti, swipe or roll-up. State changes still happen instantly.

**The No Loop Rule.** No looping attention motion (pulsing, breathing, glowing). The only loops are loading skeletons and spinners.

## Shapes

Soft, generous rounding with a clear size ladder. 10px for small controls (select, sidebar items), 14px for buttons, inputs, stat tiles, alerts and the highlighted ranking row, 20px for cards and the hero summary, and 22px for dialogs. Segmented controls nest 9px thumbs inside a 12px track with 3px inset. Icon buttons and avatars are full circles, and badges are pills. Chart bars have 6px top corners and 3px bottom corners. Shift-code chips and table cells use 9px, department chips 10px, the brush toggle and shift-picker options 12px, the brush palette 14px, and the schedule table card 20px. On Home the masthead uses 22px (bottom corners only on phones, all four at ≥981px), the shift card, notices and close-shift card 20px, pulse counters 14px, the birthday icon tile 12px and task checkboxes 7px; the day feed's rail is a 2px line with 12px ring dots. On the menu, section, category and allergen-picker chips are pills (44px tall), list groups and flash cards 20px, row thumbs and photo-field previews 12px, the search field, «Як запропонувати гостю» block and buttons 14px, the draft note 10px, allergen chips 9px, lesson numbers full circles, and progress bars 2px (4px for the 8px hero bar). Flash-card photos round only their top corners. On Personnel, face tiles are 20px cards that clip a square portrait to their top corners, the profile photo field is 4:3 and clipped by the 22px sheet, the editor portrait is an 88px circle, roster photos 56px circles and the roster editor's preview a 64px circle; group chips and contact links are 44px pills, the credo, facts and credential panels 14px, and the in-sheet error 10px. On Reservations, day chips, the search field, form fields, suggested-table tiles and the merge row use 14px; form pills, time slots, booking-action buttons, the tel button and floor tiles 12px; occasion tags and the state pill 9px; the in-card error 10px; booking cards, the floor canvas and the empty state 20px; sheets 22px. Hall chips are 44px pills and close buttons full circles. On Records, plaques, the person header and the record list use 20px; the «Твоє місце N» note and the editor's error 10px; the badge 9px; the «Ти» pill 7px; the «Внести» / «Оновити» button 12px; the select and the editor's fields 14px; the editor 22px; avatars (56px on a plaque, 64px in the person header) and the editor's close button are full circles. Dashed borders are rare: the admin «Архів» chip (it turns solid while the archive is open) and the last chip of the reservations day strip, which opens the date picker, are the only two. Borders are otherwise always solid 1px hairlines in the warm off-white alpha. There is no clipping, angle or ornamental silhouette.

## Components

### Buttons
Solid, thumb-sized and quiet, with exactly one gold button per view.
- **Shape:** 14px radius, minimum height 52px.
- **Primary:** gold fill, ink-on-gold label at 16px/700, an optional leading 18px line icon, 20px side padding. It spans the column on phones.
- **Hover / Active / Focus:** hover lightens to #DCC07A. Pressing goes to pressed gold and scales to 0.99. Disabled drops to 70% opacity. All interactive elements share a 2px gold focus outline offset by 2px. Transitions are 0.15s ease.
- **Danger:** transparent with a 35% coral border and coral 15px/600 label. A second tap confirms, turning it solid coral with an ink label.
- **Icon button:** 36px circle on brand charcoal, raised charcoal on hover. Used for the month arrows and dialog close.
- **Link:** gold 14px/600 text with no underline, used for secondary actions ("До поточного місяця", "Додати доплату").
- **Toggle:** a 42px outlined button (strong hairline, 12px radius, 14px/600, 16px leading line icon) for a mode such as the schedule brush. When on, its border and label turn gold over the gold wash, and its label says the mode is on.

### Segmented Control
- **Style:** brand-charcoal track (12px radius, 3px padding) with equal-width options 34px tall. Inactive options are text-2 at 500. The active option is a raised-charcoal thumb with text colour at 600 and the segment-thumb shadow. Semantically it is a radiogroup. The schedule's half-month switch (1–15 · 16–end) is the same control with two options, capped at 360px, shown below 1024px only.

### Tabs
- **Style:** text-only, 16px/600, 20px apart, sitting on a hairline rule. Inactive tabs are text-3. The active tab is text colour with a 2px gold underline overlapping the rule.

### Cards / Containers
- **Corner Style:** 20px. Stat tiles use 14px.
- **Background:** the hero summary (payout or place) is brand charcoal with no border. Standard cards and stat tiles are charcoal surface with a hairline border.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Internal Padding:** 16px for cards (the hero uses 16/16/14, and 22/22/20 at ≥1024px), 12px for stat tiles.
- **Card head:** 16px/600 title on the left and a 12.5px text-3 meta line on the right, baseline-aligned.

### Hero Summary (signature)
The answer-in-a-glance block. It has a 15px/500 text-2 heading ("До виплати") with the period in caption on the right, then the display figure, then a hairline and a three-column breakdown that spells out the formula (4% каси · змін × 200 · Доплати), then a caption note. The place variant shows "3 з 11" in text colour with a movement indicator.

### Inputs / Fields
- **Style:** 48px tall on brand charcoal, 1px strong-hairline border, 14px radius, 16px/500 text, gold caret, dark colour-scheme. The label above is 13px text-2. Money fields carry a right-aligned ₴ in text-3. The main cash field is a 64px hero input at 30px/700.
- **Focus:** the border turns gold, with no glow.
- **Error:** form errors are 14px light coral text below the fields. Screen-level alerts are a coral-wash bar with an underlined retry action.
- **Select:** 40px, 10px radius, with a custom chevron in text-2.

### Lists
- **Records:** full-width tappable rows separated by hairlines. The date (first letter capitalised) is 15px/500 over a caption sub-line on the left. The sum is 15px/700 over "+N ₴ до виплати" in gain green on the right. On hover the sum turns gold.
- **Ranking:** a grid of rank (24px), avatar (36px circle, initials over an optional photo), name and role, and movement. Ranks 1–3 are gold. The viewer's row sits on a gold-wash pill bleeding 10px past the list, and their name carries a gold "Ти" pill badge. Rows show place and movement only, never other people's sums, and the card ends with a caption that says so. The one exception is the Рекорди screen, where every waiter's record value is shown (see The Open Records Rule); the live Каса · Топ stays position-only.

### Day Chart (signature)
Equal-width bars with a 4px gap. Neutral bars are #5A5751 (hover #6E6A63) and the best day is gold. A 3px zero-line sits under every day, so empty days still read as days. Today gets a gold baseline and a gold 700 day number. A dashed 22% off-white average line carries a small "сер." tag. Bar height animates in 0.35s on cubic-bezier(0.16, 1, 0.3, 1). Each bar is a button that opens that day.

### Dialog
Charcoal surface, 1px strong-hairline border, 22px radius, max width 480px, over a dark scrim. It is centred on every viewport by the shared ModalRuntime, and it fades in (0.18s) and rises 24px (0.28s, same curve). It has a 19px/700 title with a circular close button, a 14px-gap form, an estimate panel on brand charcoal with the result in gold, and actions in a row (danger, then the primary filling the remaining width). Focus is trapped and Escape closes it. Dialogs render in a portal on `document.body`, and the app shell (`.app-shell`) is made inert while one is open, so Tab and screen readers cannot leave it; ModalRuntime still picks them up by `role="dialog"` and `aria-modal`. The shared `Overlay` component (`src/components/Overlay.tsx`) does both: wrap a dialog in it rather than portalling by hand.

**The Open Dialog Rule.** While a dialog is open, the page behind it is inert, so anything that happens because of the dialog reports inside it: form problems below the fields in coral text, failed actions (archive, password reset, save, delete) in a coral-wash note in the sheet, never in a page alert the user cannot reach.

### Department Chips
A horizontal, scroll-without-scrollbar row of 36px chips (10px radius, 6px gap) on brand charcoal, 14px/500 in text-2 with a text-3 head count. The active chip steps up to raised charcoal with text colour at 600 and no shadow. Semantically a tablist.

### Shift Code Chip
A compact code label (26px tall, minimum 34px wide, 9px radius, 13px/700) on raised charcoal, tinted by the shift-code palette for leave, breakfasts, bar and mixed codes. It appears in the day list, the legend (22px tall, 11.5px), the picker and the brush. Below the table, a wrapping legend pairs each chip with its 12.5px label in text-2.

### Schedule Table (signature)
The paper schedule kept as a people × days table inside a 20px charcoal card with a hairline border. The name column is sticky on charcoal surface with a hairline right edge. The head shows weekday over day number; weekend heads lift the weekday to text-2, and weekend cells carry a barely-there 2% warm off-white field. Cells are 32px buttons (9px radius) holding the code in its tone, with raised charcoal on hover. Today's column is washed in gold haze with a gold weekday and day number. The viewer's row is washed in gold haze with the name in gold at 600, and it stays in its department order. A «На зміні» count row in the footer (12px, text-3) counts working shifts per day, with today's count in gold at 700. A saving cell shows a small spinner; the table dims to 60% while a month refreshes.

### Day List
The «Мій графік» view: a 20px card of hairline-separated rows (8px 14px padding) with the day number (16px/700) over the weekday (11.5px, text-3), the shift label (15px), and a code chip on the right. Today's row is washed in gold haze with a gold day number and a «Сьогодні ·» prefix. Rows step to brand charcoal on hover.

### Bar-Only Shift Codes
Waiters get Р · СН · Х · О. The bar and sommelier codes (Б, С «Сомельє», Р/Б, СН/Б, С/Р «Сомельє + робоча», С/Б «Сомельє + бар») belong only to a waiter whose second role is the bar: the shift picker offers them only on that person's row, the brush refuses them on anyone else with a plain sentence, and `tiflis-secure-api` rejects them on save. Old entries stay visible as they are.

### Zone Bookings (Обов'язки)
Under a staffed zone the admin can attach bookings. Кабінки shows five 44px tabs «Кабінка 1» … «Кабінка 5» (three per row at 420px and narrower); a filled tab carries a 6px gold dot and gold text, the open one the gold wash. The form: «Час» and «Гостей» side by side, «Імʼя» full width (booths only), the «Є меню» / «Без меню» pair and «Прибрати бронювання» in the danger tone; filled bookings are summarised under the tabs as one-line chips («Кабінка 2 · 19:00 · 6 гостей · Іван · з меню»). Камінний зал and Нижній зал №2/№3 show the same form once, titled «Банкет», with the name too. Загальний зал and Літня тераса have none. A started booking without time or guests blocks the save with a sentence naming the zone. Published bookings reach the zone's waiter in the Telegram message under the zone and on Home as day-feed events at their time.

### Brush Palette
The admin paint tool. A floating bar on raised charcoal with a strong hairline and 14px radius, holding every code at once in a five-column grid of 40px chips on brand charcoal (tinted for leave, breakfasts and bar), with nothing hidden behind scrolling. The selected code takes a 2px gold outline. A gold «Готово» button (10px radius, 700) closes it; it is the view's gold action while the brush is open.

### Shift Picker
A dialog (charcoal surface, strong hairline, 22px radius, 420px max, 18px padding) titled with the person's name (19px/700) over the full date (13.5px, text-2), with a circular close button. Codes sit in a two-column grid of 52px options on brand charcoal (12px radius), each a code chip plus label; the current code gets a gold border and a gold check.

### Home Masthead (signature)
The restaurant's sign at the top of Home, and the only gold field in the portal (see The Gold Is Earned Rule). A flat gold field with everything on it in ink on gold: the charcoal wordmark top left (150px wide, 190px at ≥981px), the date (capitalised weekday, day and month) over the Kyiv time top right, and the greeting below. The time updates every 30 seconds. On phones the masthead bleeds edge to edge, replaces the shell top bar, and rounds only its bottom corners (22px). At ≥981px it is a banner across both columns with all four corners rounded and the time at 40px. On the viewer's own birthday the greeting becomes «З днем народження, …!».

**Wordmark provenance.** The masthead wordmark is `src/assets/brand/tiflis-wordmark-charcoal.png` (420×267). It is derived from the supplied `brand/tiflis-logo-black-transparent.png` with its fill recoloured to #2B2A29, and it matches the supplied variant `brand/tiflis-logo-gold-bg-charcoal.png` (charcoal on gold). It is the only wordmark used on gold.

### Shift Card (signature)
Home's answer-in-a-glance block, overlapping the masthead's lower edge. It sits on brand charcoal with a strong hairline and a 20px radius. A 19px/700 headline follows the phase («Зміна о 12:00», «Зміна до 22:00», «Зміну завершено»), with a gold 14px/600 countdown on the right («через 45 хв», «ще 3 год 50 хв», or «чекає на касу» while the cash is still owed). Below it a 6px progress track on raised charcoal (3px radius) fills the elapsed part in 45% gold. Each of today's reservations sits on the track at its time as a 12px ring (2px text-2 border on brand charcoal). During the shift a 3 × 16px gold now marker stands at the current time. A 12px text-3 line under the track shows the shift code chip (legend size: 22px tall, 9px radius, 11.5px) with the hours, and the viewer's zone on the right. On a day off the card reads «Сьогодні вихідний» with the next shift beneath it and no track. While loading it is an 84px pulsing block.

**Shift hours and phase.** The phase comes from the viewer's code in today's schedule and the Kyiv clock (Europe/Kyiv). Р and every other working code run 12:00–22:00; СН and СН/Б run 11:00–22:00; Х and О are not working days. Before the start the phase is *before*, from the start to 22:00 it is *during*, from 22:00 it is *after*, and a non-working day is *off*. The phase drives the shift card, the day feed's now marker, and the close-shift card.

### Team Faces
The lower half of the shift card, below a hairline: up to five overlapping 34px circles (−9px overlap, 2px brand-charcoal ring, raised charcoal with 11.5px/600 initials in text-2 under an optional photo), then a «+N» disc, a 14px text-2 line («Сьогодні з тобою 10 людей», or «Сьогодні працюють N людей» on a day off) and a chevron. The viewer comes first, marked by a 1.5px inset gold ring and gold initials. The whole row links to the schedule and steps to raised charcoal on hover.

### Birthday Notice
A one-row notice card (charcoal surface, hairline, 20px radius, 12px 14px padding) with a 40px raised-charcoal tile (12px radius) holding a cake line icon in text-2, a 15px/600 line saying when («Завтра день народження», «У неділю день народження», or a date), the names in 13px text-2 beneath, and a chevron. It shows only the nearest staff birthday; the viewer's own birthday appears in the masthead greeting instead. When the birthday is today the card moves to the gold haze with a strong hairline, and the icon tile turns gold wash with a gold icon. It links to the staff page and steps up to brand charcoal on hover.

### Pulse Counters
Up to four equal tiles in one row (6px gap): charcoal surface, hairline, 14px radius, 10px 6px padding, with a centred 20px/700 figure over an 11.5px text-3 label. Waiters see reservations and guests; everyone sees duties done (as «1/3») and the head count on shift. Labels decline with the count. The counters are neutral; none is gold.

### Day Feed (signature)
The shift read as one timeline, from «Початок зміни» to «Кінець зміни» at 22:00. Each event is a three-column row (a 46px right-aligned 13.5px/600 time in text-2, a 16px rail, then the body), at least 50px tall. The rail is a 2px raised-charcoal line with 12px ring dots (2px text-3 border on the ground), and it stops at the last dot. A body has a 15px/600 title and a 13px text-3 note. For waiters, today's reservations slot in by time («Стіл 3 · 4 гості»), with a text-2 pill tag («гості вже за столом») once the guests are seated. Duties hang under the start as a hairline card of 44px checkbox rows (22px box, 7px radius, strong-hairline border). A done row fills its box with raised charcoal and strikes its text through in text-3. Past events fade to text-3 with filled raised-charcoal dots. During the shift a «Зараз» row sits at the current time, with its time, title and filled dot in gold. The end event tells cash roles when to enter the cash. On phones the feed follows the cards; at ≥981px it fills the right column.

### Close-Shift Cash Card
After 22:00, for cash roles only: a brand-charcoal card (strong hairline, 20px radius, 16px padding, 12px gap) titled «Закрий зміну: внеси касу» at 17px. Two fields sit side by side (1.4fr : 1fr, 10px gap), «Каса» and «Чайові». Both reuse the 64px, 30px/700 hero money input from the cash screen, set one step down on charcoal surface inside the card, with the ₴ suffix in text-3 and a gold border on focus. The gold «Зберегти касу» button below is the view's one gold action. Errors are 14px coral text. Once the cash is saved, the card collapses into a notice row («Касу за сьогодні внесено», with the sums in text-2) that links to the cash screen.

### Tomorrow Card
From 13:00, when tomorrow's duty plan is published and assigns the viewer something: a notice row (the birthday notice card without the icon tile) reading «Завтра · Зал 1 · столи 1–6» at 15px/600 over the count of duties already assigned, linking to the duties page.

### Menu Mode Switch
The menu's Довідник / Тренажер / План switch is the Segmented Control with three segments (a radiogroup, capped at 420px). Editors also get an outlined «Позиція» button beside it (strong hairline, 12px radius, 14px/600, leading plus icon); it is not gold.

### Menu Chips
- **Section chips:** a radiogroup of 44px pills (strong-hairline border, transparent, 14px/600 in text-2, 8px gap). The selected section takes a gold border, gold wash and gold label; it is the current selection, not an action.
- **Category chips:** a quieter row of 44px pills on charcoal surface with no border (13.5px/500 in text-2), led by «Усі». Each is a toggle with `aria-pressed`; the selected one steps up to raised charcoal with text colour. No gold.
- **Behaviour:** below 981px each row scrolls sideways behind a right-edge fade; at 981px and wider both rows wrap. Hover steps unselected chips to raised charcoal. Both rows hide while searching or reviewing drafts.

### Reference List (signature)
The Довідник: the menu as a calm reference, grouped by category in menu order. Each group has a 16px/700 heading with its count, then a 20px charcoal-surface card of hairline-separated rows. A row is a button: a 56px thumb (12px radius; the photo, or the dish's initials at 15px/700 in text-3 on raised charcoal), the name at 15px/600 with a 14px gold check when the viewer knows the dish, the composition clamped to two lines in text-2, and on the right the price (15px/700) over the weight (12.5px, text-3). A bare number weight is suffixed г for the kitchen and мл for bar and wine. Rows step to brand charcoal on hover or press. Search («Страва, складник або алерген») is a 48px charcoal-surface field with a strong hairline, 14px radius and gold border on focus; results regroup as «Розділ · Категорія». For editors a hairline link row with a coral alert icon reads «Чернетки на перевірку: N» and filters the list to drafts.

### Dish Sheet (signature)
A dish read as a briefing, in this order: the photo (16:9) or an 88px initials band with a translucent round close button over it; the name (23px/700); a facts line with the price (19px), weight, category and kitchen times («25 хв · у завал 35 хв»); the draft note when the teaching text is unreviewed; then titled blocks «Що це», «Склад і подача», «Як запропонувати гостю» (the line in «» quotes on a brand-charcoal block, 14px radius, 16px text), «До чого порадити», and «Алергени» as coral chips. The last action is «Знаю цю страву», an outlined brand-charcoal button that turns into the gold «Знаю» button once the dish is known; editors get a quiet «Редагувати» beside it. It is a dialog on charcoal surface with a strong hairline and 22px radius, up to 560px wide, with the close button focused on open.

### Draft Note
A neutral note on brand charcoal (10px radius, 10px 12px padding, 13.5px/1.45 text-2) led by a small coral alert icon: «Чернетка: кухня ще не перевірила поради й алергени.» It appears in the dish sheet and the trainer answer whenever a dish's teaching text is unreviewed.

### Flash Card (signature)
The Тренажер's card on charcoal surface (20px radius). The top is the photo (16:10, top corners rounded) or an 88px initials band, then the name at 24px/700 and the prompt «Що входить? Як запропонуєш гостю? Які алергени?» in text-2, then the gold «Перевірити себе». The answer reveals the dish sheet's blocks in the same order, rising 8px and fading in over 0.28s (cubic-bezier(0.16, 1, 0.3, 1)), and ends in a two-column pair: «Ще вчу» (secondary) and the gold «Знаю». Above the card a link with the topic name exits, «N з M» counts on the right, and a 4px gold progress bar shows the deck so far. A deck deals dishes still being learned first, then never-seen dishes, then known ones, each group shuffled. Focus moves to the card title on every new card and on reveal. Before a deck starts, the trainer offers one gold «Тренувати невивчені · N» and a hairline list of topics with «known з total».

### Lesson Path (signature)
The План: a hero on charcoal surface (20px radius, 18px padding) with a 40px/700 known count in text colour over «з N страв кухні й сезонного меню», an 8px gold progress bar, and the gold «Продовжити: тема» button. Below it, a numbered list of lessons in menu order (one per kitchen category, then the seasonal menu) in a hairline card: a 32px raised-charcoal number disc, the title (15px/600) over «N з M знаю» (12.5px, text-3), a 4px gold progress bar, and a chevron. A completed lesson's disc turns gold wash with a gold check in place of the number.

### Progress Bar
A 4px raised-charcoal track (2px radius) with a gold fill that eases its width over 0.3s; the plan hero uses an 8px track (4px radius). Gold here is the viewer's own progress.

### Menu Editor
The kitchen and admin dialog (charcoal surface, 22px radius, up to 640px, 18px padding) titled «Нова позиція» or «Редагувати позицію» with a flat round close button. A two-column form (one column below 560px) holds name, section, category, price, weight, kitchen times, a device photo upload (resized on the device, shown as a 64px preview with «Змінити фото» and «Прибрати»), then the teaching fields: «Склад і подача», «Що це / як вимовляти», «Як запропонувати гостю», «До чого порадити». Allergens are a group of 44px checkbox pills (strong-hairline outline in text-2; checked ones take coral wash and coral text with a check). A brand-charcoal «Перевірено кухнею» checkbox row (gold accent) clears the draft flag. Closing with unsaved changes asks for confirmation. Delete is the two-tap danger button (outlined coral, then solid coral «Так, видалити»), left of the gold «Зберегти».

### Menu Content Rules
**The Flag Not Hide Rule.** A dish whose teaching text is unreviewed (`learning_reviewed` false) is always shown, with the draft note, never hidden. Changing the teaching text (what it is, the guest line, pairing) or the allergens of a reviewed dish returns it to draft until the kitchen ticks «Перевірено кухнею» again.

**The Reference Only Rule.** Bar and wine are reference only: they appear in the Довідник with мл volumes, but have no lessons, no trainer deck and no «Знаю цю страву» button. The plan covers the kitchen and the seasonal menu.

### Personnel Switch
The Команда / Дні народження switch is the Segmented Control with two segments (a radiogroup, capped at 420px). Admins get the gold «Новий працівник» beside it: the primary button in its compact form (44px tall, 14px/700, 14px side padding, leading plus icon). It is the view's one gold action.

### Group Chips
A row of 44px pill toggles (`aria-pressed`, strong-hairline border, transparent, 14px/600 in text-2, 8px gap): «Уся команда», then each group in hall order. The selected chip takes a gold border, gold wash and gold label; hover steps unselected chips to raised charcoal. Admins get a last chip «Архів · N» with a dashed border, which switches the wall to archived people; while it is on it turns solid and gold and reads «Повернутись до команди». Below 981px the row scrolls sideways behind the right-edge fade; at 981px and wider it wraps.

### Face Wall (signature)
The Команда tab: the team as faces, grouped in the order the hall meets them: Адміністрація, Кухня, Офіціанти, Бар, Сомельє, Хостес, Ранери, Стажери, Інші. Empty groups are skipped. Each group has a 16px/700 heading with its count in text-3, then an auto-fill grid of tiles (two columns at 560px and narrower, 136px minimum, 156px minimum at 981px and up, 12px gap). A tile is a button on charcoal surface (20px radius, no border) with a square portrait at the top (the photo, cover-cropped, or 34px/700 initials in text-3 on raised charcoal), then the name at 15px/600 and the nick in «» or the role at 13px in text-2. Within a group the viewer comes first and everyone else follows by name. The viewer's tile has a 1px inset gold hairline and reads «Це ти» in gold at 600 in place of the nick. Archived people (the admin archive view) show their portrait in greyscale at 70% opacity. Tiles step to brand charcoal on hover or press. Search («Імʼя, нік або роль») is the menu's 48px search field and filters within the groups. While loading, four pulsing 4:5 blocks hold the grid.

### Profile Sheet (signature)
A person read in one sheet, opened from a tile. It is a dialog on charcoal surface (strong hairline, 22px radius, up to 480px) in this order: a 4:3 portrait with a translucent round close button over it (44px, ground at 72%), collapsing to a 120px initials band when there is no photo; the name (23px/700), which takes focus on open; the role line in text-2 (role, «nick», and the trainee days when set); the credo as a quote on brand charcoal (14px radius); a facts list on brand charcoal with hairline-separated rows: День народження, У команді (the tenure in days, months or years), and Наступна зміна (the date, then the shift code written as a word: робоча, сніданки, бар, робоча + бар, сніданки + бар; codes outside these, such as markers, are left out and only the date shows). Telegram and Instagram follow as 44px outlined pill links (strong hairline, 14px/600, leading line icon). Admins then see quiet 13px text-3 text with the login and sign-in state («входить у портал» or «ще без входу в портал», plus «в архіві»). Action errors appear here on coral wash. The actions stack full-width: «Редагувати мій профіль» on the viewer's own profile or «Редагувати» for admins (secondary), then for admins «Скинути пароль» (secondary; a second tap turns it into the solid coral «Так, скинути пароль») and the danger «Перенести в архів» (a second tap confirms «Так, перенести в архів»), or «Повернути в команду» (secondary) for an archived person. The profile has no gold.

### Secondary Button
The non-gold button in the staff sheets: 52px, brand charcoal with a strong hairline, 14px radius, text colour at 15px/600 with an optional 17px leading line icon, raised charcoal on hover, and the same 0.99 press scale as the primary.

### Profile Editor
A dialog (charcoal surface, 22px radius, up to 600px, 18px padding) titled «Редагувати профіль» or «Новий працівник» at 19px/700 with a flat round close button on brand charcoal. It opens on an 88px round portrait beside a secondary «Додати фото» or «Змінити фото» (uploaded from the device, see Photo Upload) and a quiet «Прибрати» link. The two-column form holds the personal fields: name, nick, birthday, Telegram, Instagram and the credo. For admins a «Доступ і роль» section (14px/700 over a hairline) adds login, role caption, main and second role, trainee days and a gold-accented «Може надсилати сповіщення» checkbox. A new account shows the hint that the temporary password appears once. Closing with unsaved changes asks for confirmation. The gold «Зберегти» (or «Створити акаунт») is the one gold action.

### Credential Sheet
Shown once, after an account is created or a password is reset, and it cannot be dismissed by the backdrop. Titled «Доступ нового працівника» or «Новий тимчасовий пароль» at 19px/700 over a 14px text-2 explanation, then a brand-charcoal panel (14px radius, hairline between rows) with the login and the temporary password: 12.5px text-3 terms over the values at 19px/700, 0.02em, selectable as a whole. The gold «Скопіювати дані» takes focus on open and confirms «Скопійовано»; the secondary «Дані передано — закрити» closes it.

### Birthday Roster
The Дні народження tab: the 48px search field («Імʼя або посада»), a «Посада» select, and for admins an outlined «Додати людину» (not gold), then rows sorted by the next birthday. A row is a 76px-minimum card on charcoal surface (20px radius, 10px 12px padding) with a round 56px photo (or 17px/700 initials in text-3 on raised charcoal), the name, the position, then the date with a small cake icon and the countdown («Сьогодні», «Завтра», «Через N днів»). The coming week (today through six days ahead) lifts to brand charcoal with a strong hairline and its countdown turns text colour at 600; it carries no gold. Admins get a 44px round edit button. The roster editor is a 600px dialog with a 64px round photo preview and device upload, a gold «Зберегти», and the two-tap delete (outlined coral «Видалити», then solid coral «Так, видалити»).

### Photo Upload
Every device photo upload goes through `src/lib/photo.ts`: `photoFileProblem` rejects non-images and files over 15 МБ with a Ukrainian message, and `resizePhotoFile` shrinks the longest side on the device (1600px by default for menu dishes, 900px for staff portraits and the birthday roster) and re-encodes as JPEG at 0.82 before upload. The control is a secondary «Додати фото» / «Змінити фото» button (a spinner and «Завантаження…» while working) beside a round or rounded preview and a quiet «Прибрати». There is no URL field for photos.

### Personnel Content Rules
**The Admin Only Account Rule.** Account state (the login, whether the person has signed in, and the archive) is for admins only, and it is enforced in `tiflis-staff-api`, not just hidden: for everyone else the API blanks the login and sign-in state and leaves archived people out. In the interface it is quiet text, never a badge or tile.

**The One Birthday Rule.** A person has one birthday. Saving a birthday on a staff profile updates the linked row in the birthday roster (which also drives the Telegram reminder), so the profile and the roster never disagree.

### Reservations Day Strip
A sideways row of 56 × 64px day chips (6px gap) on charcoal surface with a transparent 1px border and a 14px radius: the weekday at 11px in text-3, the date at 18px/700, and the count of live bookings at 11px/700 in text-2, left blank on an empty day. The strip starts yesterday (or one day before a far-off picked day, so the selected day always has a chip) and shows 14 days. Today's weekday turns text colour at 700 and a 4px dot sits under its count. The selected chip takes a gold border over the gold wash, with its date and count in gold (and the today dot in gold). Each chip is an `aria-pressed` button whose label spells out the day and count. The last chip is dashed (strong hairline) and opens the native date picker («Інша дата», visible mark «…»). Counts show only for days inside the loaded window (14 days before to 35 days after the selected day); days outside it show no count rather than a false zero. The right edge fades over 28px at every width.

### Reservations Day Head
The day title at 23px/700 («Сьогодні», «Завтра», or the capitalised weekday and date) over «N резервів · N гостей · N за столом» in 14px text-2; the seated part appears only when someone is seated, and an empty day reads «Резервів немає». For managers the gold «Новий резерв» (with a leading plus) sits on the right, full width at 560px and narrower; it is the page's one gold action. Below it: the Список / Схема залу switch, which wears the Segmented Control (brand-charcoal track, raised-charcoal thumb with the segment-thumb shadow) but is built as two `aria-pressed` buttons; then a 44px search («Імʼя, телефон, стіл»; list view only) on charcoal surface with a strong hairline and a gold border on focus; then hall chips, 44px pills with a strong hairline and a 12.5px text-3 count of live bookings, the selected one in gold border, wash and label. The list leads with «Усі зали»; the floor always selects one concrete hall.

### Agenda (signature)
The day as a time-ordered list of groups. Each group is a 56px time column (17px/700, 14px from the top) beside its booking cards, 8px apart; at 560px and narrower the time sits above the cards. Only live bookings (waiting or seated) are in the agenda; search and the hall chip filter it. An empty day is a 20px charcoal-surface panel with one 15px text-2 sentence and, for managers, a secondary «Записати перший».

### Booking Card
A 20px card on charcoal surface, no border. The top is a button (for managers it opens the booking in the form) with, in order:
- the guest name (16px/700) and, on the right, the party size (19px/700 with its noun at 13px text-2);
- «Стіл 3 · Загальний зал · до 20:00» in 13.5px text-2 («Столи 3 + 4» when tables are merged);
- occasion tags as 9px-radius raised-charcoal tags (12.5px/600), then the pre-order line «Меню: …» (the label in text-3) and the free note, at 14px/1.45;
- the state pill (9px radius, raised charcoal, 12.5px/700): «За столом» in gain green with a check for a seated booking, or the closed state («Пішли», «Скасовано», «Не прийшли») in text-2. A waiting booking has no pill.

Below it, for managers, an action row of 44px buttons (12px radius, brand charcoal, strong hairline, 14px/600):
- **Waiting:** a 44px tel button (line phone icon) when there is a phone, the full-width «Прийшли» on raised charcoal at 700 with a check, and a quiet «Інше» (transparent, text-2). «Інше» opens «Не прийшли» and «Скасували» in its place and moves focus to «Не прийшли».
- **Seated:** «Стіл звільнився», then a quiet «Повернути» back to waiting.
- **Closed:** a quiet «Відновити».

A tapped button shows a spinner while it works. A failed tap reports inside that card on coral wash (10px radius, 13.5px coral text), never in a page alert. None of the actions is gold.

### Closed Bookings
Completed, cancelled and no-show bookings leave the agenda and sit under a quiet text-2 toggle at the end («Показати завершені й скасовані · N» / «Сховати завершені й скасовані», 44px, 14px/600, `aria-expanded`). Opened, they are ordinary booking cards at full opacity: the name steps down to text-2 and the table line to text-3, and the state pill names what happened.

### Floor View
«Схема залу» shows one hall at a time, chosen by the hall chips. A one-line legend (13px text-2 with 10px swatches) reads «Вільний · місць», «Резерв · час», «За столом». The hall is a 20px charcoal-surface canvas (at least 280px tall, its aspect from the table grid) with each table placed by its grid position as a small tile (at least 52 × 48px, 12px radius) showing the label at 15px/700 over an 11.5px line:
- **Free:** raised charcoal with a strong hairline, the seat count («4 м.») in text-2.
- **Booked:** a gold border on the gold wash, with the next booking's time in gold at 700 (see The Gold Is Earned Rule).
- **Seated:** no border, a 22% gain-green mix into charcoal surface, «за столом» in text colour at 600 (see The Green Means Gain Rule).

Each tile is a button whose `aria-label` also gives the state in words («Стіл 3, 4 місця, за столом, 13:00, Ірина»), so colour never carries it alone. A tap opens the table sheet.

### Table Sheet
A dialog on charcoal surface (strong hairline, 22px radius, up to 520px, 18px padding) titled «Стіл N» at 19px/700 over «зал · N місць · day» in 13.5px text-2, with a 44px round close button on brand charcoal. The day's live bookings for that table are a brand-charcoal list (14px radius, hairline-separated 56px rows): the time at 16px/700, then the name (15px/600) over guests and state (13px text-2); for managers a row opens the booking. An empty table reads «На цей день стіл вільний.» Managers get the full-width gold «Резерв на цей стіл», which opens the form with that table chosen.

### Reservation Form (signature)
The booking written down in the order of a phone call. A dialog on charcoal surface (strong hairline, 22px radius, up to 600px) whose body scrolls between a sticky header (the 19px/700 title «Новий резерв» or «Редагувати резерв», and the round close button) and a sticky footer, which sits on charcoal surface above a hairline. The footer carries the form error (14px coral text, on its own full row, so a conflict is always visible) and the gold «Записати резерв» (or «Зберегти»), with the two-tap danger «Видалити» → «Так, видалити» to its left when editing. Steps are fieldsets with a 14px/700 legend, separated by hairlines:
- **Коли:** date pills for today and the next three days («Сьогодні», «Завтра», «ср, 11»), then an «Інша дата» pill over the native date picker that shows the picked day when it is further out.
- **О котрій:** a grid of half-hour slots from 12:00 to 22:00 (72px minimum, 6px gap, 44px tall), then «Точний час», a 24-hour field that takes digits («1845» becomes 18:45) and applies only a valid HH:MM, beside the duration pills «1,5 год», «2 год», «3 год», «4 год» (2 h by default).
- **Скільки гостей:** number pills 1–6, 8, 10, 12 (48px minimum, 17px/700) and an «інше» pill holding a number field.
- **Хто:** «Імʼя гостя» and «Телефон» side by side (stacked at 560px and narrower).
- **Стіл:** after a time is chosen, the free tables at that time as 2-line tiles (auto-fill from 116px, 60px tall, 14px radius): the label at 17px/700 over «зал · N м.». The default offer is the tables that seat the party with at most two spare seats, smallest fit first, up to eight; a quiet «Показати всі вільні столи» link widens it. When no table fits the party, every free table is offered (largest first) with a coral hint to pick one and add its neighbours. Choosing a table opens the merge row on brand charcoal: «Обрано: стіл 3 + 4 · зал · N місць», then the hall's other tables as pills, raised to charcoal surface, with their seat counts; neighbours taken at that time are disabled. Coral hints say when the party outnumbers the seats or the table was taken meanwhile.
- **Привід і побажання:** occasion toggles (День народження, Річниця, Ділова зустріч, Дитячий стілець, Тиха зона, Свій торт, Декор; a check appears on the selected ones), «Ще побажання» and the «Передзамовлення меню» textarea.

Every selected pill, slot and table is a gold border on gold wash with a gold label; unselected ones are brand charcoal with a strong hairline and step to raised charcoal on hover. Fields are 48px on brand charcoal with a strong hairline, 14px radius and a gold border on focus. The title takes focus on open. Closing with unsaved changes asks for confirmation. If saving reports the table taken, the form drops the stale pick, refreshes availability and scrolls back to the table step.

### Reservation Content Rules
**The One Overlap Rule.** The client and `tiflis-reserve-api` share one overlap rule: two bookings collide when they share a table label (the primary table or a merged one) in the same hall and day, and each starts before the other ends. A missing duration counts as 2 hours. A seated booking on today's date blocks its tables until at least now + 15 minutes, on the Kyiv clock (Europe/Kyiv), however long it was booked for. The form computes free tables with this rule; the server repeats it on every save and answers a collision with a 409.

**The Status Only Rule.** Arrival and closing taps call `reserve_status`, which changes only the status, so a tap never overwrites an edit someone else saved. Closing a booking (left, cancelled, no-show) never conflicts. Seating or reopening a closed booking must still fit its table under The One Overlap Rule.

**The Occasion Marker Rule.** Occasions are stored in the booking's note, as its first line, behind the marker «Привід: », joined by « · » («Привід: День народження · Свій торт»); the free text follows on the next lines. Only that first line is read back as tags, and only known occasions, so free text that resembles a tag is never mistaken for one, and a waiter reading the raw note elsewhere still understands it.

**The Pressed Pill Rule.** Pill choices (day chips, hall chips, the view switch, date, time, duration, party size, table, merge and occasion pills) are `<button type="button">` with `aria-pressed` inside a labelled `role="group"`, never unmanaged radio inputs. The selected one is gold on the gold wash; occasion and merge pills toggle independently.

### Records Switch
The Дошка слави / Мої рекорди switch wears the Segmented Control (brand-charcoal track, 34px options, raised-charcoal thumb with the segment-thumb shadow), built as two `aria-pressed` buttons in a labelled group (The Pressed Pill Rule). When an admin views someone else, the second segment reads «Рекорди офіціанта». After it sits the race link: gold 14px/600 text «Хто лідирує цього місяця — у Касі» with a 16px chevron, 44px tall, underlined on hover. It goes to `/cash?tab=top`, which opens Каса on Топ каси; the live monthly race lives there, not here.

### Record Plaque (signature)
One plaque per record, in hall order: Каса за місяць, Каса за півмісяця, Найбільші чайові, Тарілок за раз, Столиків одночасно, Змін за місяць, Змін за півмісяця. A plaque is an `article` on charcoal surface (20px radius, 16px padding, 12px gap, no border), in this order:
- the category title, 15px/700 in text-2;
- the holder row: a 56px avatar (photo, or 18px/700 initials in text-3 on raised charcoal), then the value (a 30px/700 figure, then its unit at 15px in text-2), a 14px gold trophy with the holder's name at 15px/600, and the period at 13px in text-3 («серпень 2026», «1–15 серпня 2026», or the date for a manual record);
- on a tie, every holder of the best value shares the record: one avatar and one value, then the co-holders stacked 4px apart, each with a trophy, their name and their own date;
- places 2–5 as an ordered list of hairline rows (22px rank column, 9px vertical padding, 14px): the shared rank in text-3 at 700, the name with an ellipsis, and the value at 600 on the right. Ranks are shared on ties (The Shared Place Rule);
- «Твоє місце N · value», a note on brand charcoal (10px radius, 10px 12px padding, 14px text-2, N in gold at 700), shown only when the viewer has a value but is outside the plaque's list.

The viewer is marked in place wherever they appear: their name (and in a place row, their rank) turns gold at 700 and carries the «Ти» pill. An empty plaque is one 14px text-3 sentence («Ще немає даних.», or for a manual record «Рекорд ще ніхто не вніс. Може, ти перший?»). The plaques fill an auto-fill grid with a 320px minimum, `dense` and top-aligned (see Layout). No medals, podium colours or ornament.

### Viewer Pill
Рекорди marks the viewer with a «Ти» pill in gold on the gold wash (12px/700, 1px 7px padding, 7px radius, 6px after the name, never wrapping). The records stylesheet calls it the same pill as Каса · Топ, but in the build Каса's «Ти» is still the solid gold pill described under Lists (gold fill, ink on gold, 11px/700, fully rounded). The two have not been reconciled, so there is not yet one viewer marker across screens; when they are reconciled, record the survivor here and under Lists.

### Person Header
The top of Мої рекорди: a card on charcoal surface (20px radius, 16px padding, 14px gap, no border) with a 64px avatar (21px/700 initials), the name at 21px/700 and «Серед N офіціантів» at 14px in text-2. Admins (who may view everyone) get a select on the right, «Чиї рекорди» as its hidden label, listing every waiter with « (ти)» after their own name: 44px tall, brand charcoal, strong hairline, 14px radius, 15px/500, dark colour-scheme. At 560px and narrower it takes a full row.

### Personal Record Row
Мої рекорди is one list card on charcoal surface (20px radius) of hairline-separated rows (14px 16px padding), one per record in hall order. A row has two sides:
- **Left:** the category title (14px/600, text-2), the value (a 22px/700 figure, then the unit at 14px in text-2), and when (13px, text-3). With no value it reads «Ще не внесено» for the viewer's own manual record, «Не внесено» for someone else's, or «Ще немає даних».
- **Right:** «N місце з M» (N at 17px/700 in text colour, M the number of waiters), or, when the value equals the best one, the «Рекорд ресторану» badge (gold on the gold wash, 9px radius, 4px 10px, 12.5px/700, with a 14px trophy). Beneath it, «до рекорду …» with the gap to the record, or «рекорд — …» with the record itself when there is no value yet, at 13px in text-3. For manual records, when the viewer may edit (their own, or any for record editors), a 40px «Внести» (plus icon) or «Оновити» (edit icon) button on brand charcoal with a strong hairline, 12px radius and 14px/600, raised charcoal on hover. It is not gold.

### Manual Record Editor
A dialog through the shared `Overlay`, on charcoal surface (strong hairline, 22px radius, up to 480px, 18px padding plus the bottom safe area, 14px gap), titled with the category (and « · name» when editing someone else's) at 19px/700, with a 44px round close button on brand charcoal. A 14px/1.45 text-2 hint says what counts («Найбільші чайові за один стіл або подію.»). Then the fields:
- the value, a 64px hero input on brand charcoal (strong hairline, 14px radius) with a 30px/700 figure, a gold caret, and the unit (₴ or шт.) inside it on the right in text-3 at 600; it takes focus on open;
- «Коли», a 48px native date field, no later than today.

Validation and save errors appear in a coral-wash note (10px radius, 14px coral text) inside the dialog (The Open Dialog Rule). The actions are a row: for an existing record the two-tap danger delete on the left («Видалити», then solid coral «Так, видалити» with a trash icon), and the gold «Зберегти» with a check (a spinner while saving) filling the rest. It is the view's one gold action.

### Records Content Rules
**The Shared Place Rule.** Equal values share a place, in competition ranking: 1, 1, 3. The server numbers rows sequentially (1, 2, 3), so the client recomputes places from the top five: a row's place is one plus the number of rows with a strictly greater value. Everyone on the best value holds the record together (co-holders on the plaque, and the «Рекорд ресторану» badge in Мої рекорди), and nobody on the best value is ever called «2 місце». A value of zero holds nothing.

**The Server Halves Rule.** Half-month records and the cash top follow one split, computed in `tiflis-secure-api`: 1–15 and 16–end, labelled «1–15 серпня 2026» and «16–31 серпня 2026», the same split as the schedule, so the dates shown always match the sum. Records count the immutable `first_cash`, like the cash top, and tied values share a place (1, 2, 2, 4), with whoever reached the value first listed first. The one exception is payroll: the cash overview pays out cash for 1–14 and the rate and extras for 1–15, and says so in its note.

**The Open Records Rule.** On Рекорди every waiter's record value is visible to every waiter, money included (best month and half-month cash, largest tip), on the plaques and in their top five. This is the owner's exception to the privacy rule, recorded in PRODUCT.md («Owner exception (November 2026): Рекорди»), chosen for the competition. It is scoped to this screen: the live Каса · Топ, and every other ranking or shared view, still shows place and movement only, never other people's sums. The board covers waiters only.

### Navigation
- **Desktop sidebar:** charcoal surface with a hairline right edge and the gold wordmark (92px) at the top. Items are 10px-radius rows in text-2. Hover and active states move to brand charcoal with text colour, and the active icon turns gold. No indicator bars or glows.
- **Mobile:** a top bar with a translucent ground and blur, the gold wordmark (68px), a strong-hairline divider, and the page title in Golos 700. The floating bottom bar uses translucent charcoal. The active item gets a gold wash with a gold icon and label, and the central home disc turns solid gold when active. On Home the top bar is hidden on phones; the gold masthead takes its place.

### States
Loading uses skeleton blocks shaped like the real layout (segment, hero, row, chart) that pulse to 55% over 1.4s, plus a 60% fade on content while refreshing. Empty states are one plain 14px sentence in text-2 that tells the worker what to do next. Every animation and transition is disabled under `prefers-reduced-motion` (see Motion). Screens open from memory first: every read reply is remembered for the session (`peekSecureApi`), so a module opened again paints its last known data at once and refreshes it quietly, without the 60% refresh fade, which is kept for a real change of month or period. A few seconds after Home loads, AppShell warms the code of every module the user can open and then the first data of Графік, Каса, Меню, Рекорди, Резерви and Персонал, one request at a time (skipped on «save data»); pressing a tab starts its request before the tap lands. Skeletons therefore appear only on the very first, cold open. A write clears the remembered copies of its domain, and sign-out clears them all.

## Do's and Don'ts

### Do:
- **Do** build migrated screens on the `--t-*` tokens and the cash-v3 patterns (hero summary, stat tiles, segmented control, cards, hairline lists, dialog).
- **Do** keep gold for the viewer's money, the viewer's own learning progress, the single primary action, and the current selection (The Gold Is Earned Rule).
- **Do** show sums with `tabular-nums`, uk-UA grouping and a trailing ₴, and explain each total with its formula directly beneath it.
- **Do** put the primary action within thumb reach above long content, and size touch targets at 36px or more (52px for primary actions).
- **Do** raise elements by stepping up the surface ramp (ground → surface → surface-2 → surface-3) with 1px warm hairlines.
- **Do** pair gain green and loss coral with an arrow, sign or word.
- **Do** use the supplied gold wordmark file as-is in the shell, and the charcoal wordmark (see Home Masthead) on the Home masthead.
- **Do** keep every dialog on the shared ModalRuntime so dialogs centre consistently on phones.
- **Do** mark today and the viewer in tables with the gold haze (gold-wash) in place, keeping the department's order.
- **Do** show every shift code with its letters and a visible legend (The Closed Legend Rule).
- **Do** write all interface copy in Ukrainian, and greet the viewer by first name in the vocative («Добрий вечір, Вікторе»). A name that can't be declined (Latin script, a nickname) stays as written, and with no name the greeting says «колего».
- **Do** keep the gold masthead flat and on Home only, with every element on it in ink on gold.
- **Do** show allergens by name as coral-wash chips with coral text, and flag unreviewed teaching text with the draft note instead of hiding it.
- **Do** render dialogs in a portal with the app shell made inert behind them, through the shared `Overlay` component, and report errors inside the open dialog (The Open Dialog Rule).
- **Do** show people as faces first (photo or initials), grouped in hall order, with the viewer marked in place by an inset gold hairline and «Це ти».
- **Do** upload photos from the device through `src/lib/photo.ts`, resized before upload.
- **Do** keep account state (login, sign-in, archive) admin-only in the API as well as the interface (The Admin Only Account Rule).
- **Do** group the reservations day by time, keep arrival to one tap («Прийшли»), and report a failed tap inside the card that was tapped.
- **Do** compute free tables with the same overlap rule as the server (2 h default, seated until now + 15 min, Kyiv time) and change status through `reserve_status` only (The One Overlap Rule, The Status Only Rule).
- **Do** build pill choices as `aria-pressed` buttons in a labelled group (The Pressed Pill Rule), and give floor state in words in the tile's `aria-label` as well as in colour.
- **Do** give tied values a shared place (1, 1, 3) and let everyone on the best value hold the record (The Shared Place Rule).
- **Do** label half-month records and the cash top with the 1–15 / 16–end split; only the payroll overview keeps its own cash 1–14 rule (The Server Halves Rule).
- **Do** send the live race to Каса · Топ (`/cash?tab=top`) rather than building a second «топ» on Рекорди.

### Don't:
- **Don't** add a light theme; the ground is dark only.
- **Don't** add themed ornament (wine, menu, Georgian folklore or other motifs), gradients, glows or patterns. The edge-fade mask on a sideways-scrolling chip row is a scroll cue, not a painted gradient.
- **Don't** reintroduce the old green palette, wine accent or Prata, or reference the legacy token names (`--bg`, `--gold`, `--green`, …) in new code.
- **Don't** use more than one gold-filled button in a view, or use gold as a section background. The one exception is the Home masthead: on the home page only, a flat #D1B46B field with its text in ink on gold (`--t-on-gold`).
- **Don't** add drop shadows to cards; the segment-thumb shadow is the only one.
- **Don't** show other people's sums in rankings or shared views; show place and movement. The one exception is Рекорди, where every waiter's record value is shown by the owner's decision (The Open Records Rule); it does not extend to Каса · Топ or any other screen.
- **Don't** redraw, re-letter or recolour the Tiflis wordmark beyond the supplied variants. The Home charcoal wordmark matches the supplied charcoal-on-gold variant (see Home Masthead for its provenance).
- **Don't** use the cool bar blue or the shift-code tints outside shift codes. Coral wash keeps its own warning sense for alerts and allergens.
- **Don't** mark a seated booking in gold or a waiting one in green; seated is gain green with «За столом», waiting is neutral in the agenda and gold only as a floor tile.
- **Don't** fade closed bookings with opacity; keep them readable at full opacity and step their text down to text-2 and text-3.
- **Don't** give records medals, podium colours or a gold field; gold on Рекорди is the trophy, the viewer, the «Рекорд ресторану» badge, «Зберегти» and the race link.
