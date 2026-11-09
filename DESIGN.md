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
---

# Design System: Tiflis Staff Portal

## Overview

**Creative North Star: "The Night-Shift Ledger"**

A category-standard staff dashboard played straight and finished to banking-app craft (the owner's reference is monobank). The worker's money comes first: one large gold figure, its formula spelled out beneath it, one primary action, then data in calm cards. Everything sits on a warm charcoal ground taken from the supplied Tiflis logo, tuned for a phone held in one hand in a dim restaurant hall. The ground is dark only: the owner rejected a light theme for evening use.

The system carries no themed ornament: no wine, menu, Georgian folklore or other motifs, and no gradients, glows or patterns. Character comes from the brand pair (charcoal and gold), confident tabular numbers in one sans, tonal surface steps, and generous 14–20px radii. Gold is scarce and always means something: your money, your action, your current selection.

**Migration state.** The cash screen (`src/pages/CashPage.tsx`, `src/components/CashTopList.tsx`, styles in `src/pages/cash-v3.css`) was the first screen built on this system. The schedule screen (`src/pages/SchedulePage.tsx`, styles in `src/pages/schedule-v3.css`) is the second. The portal tokens (`--t-*`) live in `src/theme/tiflis-theme.css`, which loads last and also rethemes the shared shell (sidebar, top bar, mobile bottom nav, avatars). Every other screen still carries legacy styles: hard-coded greens from the old portal, Prata headings, and older panel patterns. As a bridge, the legacy token names (`--bg`, `--surface`, `--surface-2`, `--surface-3`, `--surface-raised`, `--border`, `--border-strong`, `--text`, `--muted`, `--gold`, `--gold-soft`, `--green`, `--danger`) now resolve to the `--t-*` values, so older screens get the brand ground without being redesigned. The bridge is temporary. When you migrate a screen, use the `--t-*` tokens and the cash-v3 component patterns below, and remove its hard-coded colours and Prata. Don't add new uses of the legacy names.

**Key Characteristics:**
- Warm charcoal ground with three tonal surface steps; depth comes from tone, not shadow.
- Brand gold (#D1B46B) used sparingly, only for meaning.
- One self-hosted UI sans (Golos Text, 400–700), tabular figures everywhere money appears.
- Summary first, one gold primary action per view, data in rounded cards.
- Phone-first single column, which becomes a two-column dashboard at 1024px.
- Green and red only for gain and loss, always paired with an arrow or sign.
- Dense team data stays a people × days table; today and the viewer are marked in place with a faint gold haze, never reordered.

## Colors

A warm near-black ramp built around the logo's charcoal, a single brand gold, and two signal colours kept for movement.

### Primary
- **Tiflis Gold** (gold): the brand gold sampled from the supplied logo. Used for the payout figure, the primary button, the active tab underline, the "today" chart label and baseline, the best-day bar, podium ranks (1–3), the "Ти" badge, text links, the keyboard focus ring, the input caret, the active mobile-nav item, and active sidebar icons.
- **Pressed Gold** (gold-press): pressed state of gold buttons only.
- **Gold Wash** (gold-tint): a quiet 12% gold field that marks *you* in a list (the highlighted ranking row) and the active mobile-nav item. Selection highlight uses the same gold at 35%.
- **Gold Haze** (gold-wash): a fainter 7% gold field for marks that span a whole table column or row: today's column and the viewer's own row in the schedule, and today's row in the day list. It is faint enough to cross code tints without fighting them.
- **Ink on Gold** (on-gold): text and icons placed on gold, and on the confirmed-delete red.

### Neutral
- **Night Ground** (ground): page background, `theme-color`, and the boot screen.
- **Charcoal Surface** (surface): standard cards, stat tiles, dialog body, desktop sidebar.
- **Brand Charcoal** (surface-2): the logo's charcoal. Used for the hero summary card (payout or place), the segmented-control track, inputs, the select, icon buttons, and the estimate panel inside the dialog.
- **Raised Charcoal** (surface-3): the active segment thumb, avatar discs, the chart zero-line, and icon-button hover.
- **Hairline** (line) and **Strong Hairline** (line-strong): warm off-white at 8% and 16%. Use line for card borders and list dividers, line-strong for input, select and dialog borders and the mobile-nav edge.
- **Warm Paper** (text): primary text and figures.
- **Muted Stone** (text-2) and **Quiet Stone** (text-3): secondary and tertiary text (labels, meta, captions). The two are close in value. text-2 carries labels that must read; text-3 carries metadata and inactive tabs.

### Tertiary (signal)
- **Gain Green** (up): positive rank movement and the "+N ₴ до виплати" line on records. Nothing else.
- **Loss Coral** (down): negative movement, destructive actions, and error states. Alert and error text use Coral Text (down-text), a lighter coral that stays legible on the wash; the cash alert sits on a 12% coral wash and the schedule alert on Coral Wash (down-tint).
- **Coral Wash** (down-tint): the 14% coral field behind the schedule's load-failure alert and the leave code.
- **Coral Text** (down-text): alert and form-error text on a coral wash, on both the cash and schedule screens.

### Shift-code palette
A closed categorical legend used only for schedule shift codes. The letter code always carries the meaning; colour only groups.
- **Work** (Р): text colour, no tint. **Day off** (Х): text-3 at weight 500. **Neutral** (С, and an unassigned cell): text-2.
- **Leave** (О): loss coral on coral wash.
- **Breakfasts** (СН): gold on gold wash.
- **Cool Bar** (bar) on **Bar Wash** (bar-tint): the bar shift (Б). Mixed codes (Р/Б, СН/Б) set text colour on the bar wash. The cool blue exists only for this and appears nowhere else in the portal.

### Named Rules
**The Gold Is Earned Rule.** Gold marks money that belongs to the viewer, the one primary action, or the current selection. It is never a background wash for a section, a decorative border, or a heading colour.

**The Green Means Gain Rule.** Green and coral appear only for movement and consequence (gain, loss, delete, error) and always with an arrow, sign or word next to them. Green is never a brand or success-decoration colour. This rule retires the old green-era palette.

**The Closed Legend Rule.** Shift-code colours are a closed legend: every coloured code shows its letters, and the screen shows the legend. Inside that legend, gold on gold wash means breakfasts and coral on coral wash means leave; this is the only place gold and coral carry a category instead of the meanings above. Never borrow the code tints, or the cool bar blue, for anything else.

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
- **≥ 1024px:** the overall gap grows to 20px. The overview becomes a two-column grid (1.25fr : 1fr), with payout, stats, action and chart on the left and records spanning the right. The top view splits 1fr : 1.4fr. Segmented controls cap at 420px (three options) or 520px (four). The hero card pads 22px and the chart grows from 132px to 176px tall.

## Elevation & Depth

The system is flat and tonal. Depth is a step up the ground → surface → surface-2 → surface-3 ramp, plus hairline borders. The only in-content shadow is the small one under the active segment thumb. Overlays use a dark scrim (rgba(8, 8, 7, 0.62)). The top bar uses a translucent ground (88%) with a 16px backdrop blur, and the mobile nav uses translucent surface (96%). The schedule's floating brush palette follows the same rule: it sits on raised charcoal with a strong hairline and no shadow, and the shift picker uses the same scrim.

### Shadow Vocabulary
- **Segment thumb** (`box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35)`): only on the selected option of a segmented control, to lift it off the track.

### Named Rules
**The Tone Not Shadow Rule.** To raise something, move it one step up the surface ramp. Don't add a drop shadow, glow or gradient. The summary card sits on brand charcoal, while ordinary cards sit one step lower with a hairline border.

## Shapes

Soft, generous rounding with a clear size ladder. 10px for small controls (select, sidebar items), 14px for buttons, inputs, stat tiles, alerts and the highlighted ranking row, 20px for cards and the hero summary, and 22px for dialogs. Segmented controls nest 9px thumbs inside a 12px track with 3px inset. Icon buttons and avatars are full circles, and badges are pills. Chart bars have 6px top corners and 3px bottom corners. Shift-code chips and table cells use 9px, department chips 10px, the brush toggle and shift-picker options 12px, the brush palette 14px, and the schedule table card 20px. Borders are always 1px hairlines in the warm off-white alpha. There is no clipping, angle or ornamental silhouette.

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
- **Ranking:** a grid of rank (24px), avatar (36px circle, initials over an optional photo), name and role, and movement. Ranks 1–3 are gold. The viewer's row sits on a gold-wash pill bleeding 10px past the list, and their name carries a gold "Ти" pill badge. Rows show place and movement only, never other people's sums, and the card ends with a caption that says so.

### Day Chart (signature)
Equal-width bars with a 4px gap. Neutral bars are #5A5751 (hover #6E6A63) and the best day is gold. A 3px zero-line sits under every day, so empty days still read as days. Today gets a gold baseline and a gold 700 day number. A dashed 22% off-white average line carries a small "сер." tag. Bar height animates in 0.35s on cubic-bezier(0.16, 1, 0.3, 1). Each bar is a button that opens that day.

### Dialog
Charcoal surface, 1px strong-hairline border, 22px radius, max width 480px, over a dark scrim. It is centred on every viewport by the shared ModalRuntime, and it fades in (0.18s) and rises 24px (0.28s, same curve). It has a 19px/700 title with a circular close button, a 14px-gap form, an estimate panel on brand charcoal with the result in gold, and actions in a row (danger, then the primary filling the remaining width). Focus is trapped and Escape closes it.

### Department Chips
A horizontal, scroll-without-scrollbar row of 36px chips (10px radius, 6px gap) on brand charcoal, 14px/500 in text-2 with a text-3 head count. The active chip steps up to raised charcoal with text colour at 600 and no shadow. Semantically a tablist.

### Shift Code Chip
A compact code label (26px tall, minimum 34px wide, 9px radius, 13px/700) on raised charcoal, tinted by the shift-code palette for leave, breakfasts, bar and mixed codes. It appears in the day list, the legend (22px tall, 11.5px), the picker and the brush. Below the table, a wrapping legend pairs each chip with its 12.5px label in text-2.

### Schedule Table (signature)
The paper schedule kept as a people × days table inside a 20px charcoal card with a hairline border. The name column is sticky on charcoal surface with a hairline right edge. The head shows weekday over day number; weekend heads lift the weekday to text-2, and weekend cells carry a barely-there 2% warm off-white field. Cells are 32px buttons (9px radius) holding the code in its tone, with raised charcoal on hover. Today's column is washed in gold haze with a gold weekday and day number. The viewer's row is washed in gold haze with the name in gold at 600, and it stays in its department order. A «На зміні» count row in the footer (12px, text-3) counts working shifts per day, with today's count in gold at 700. A saving cell shows a small spinner; the table dims to 60% while a month refreshes.

### Day List
The «Мій графік» view: a 20px card of hairline-separated rows (8px 14px padding) with the day number (16px/700) over the weekday (11.5px, text-3), the shift label (15px), and a code chip on the right. Today's row is washed in gold haze with a gold day number and a «Сьогодні ·» prefix. Rows step to brand charcoal on hover.

### Brush Palette
The admin paint tool. A floating bar on raised charcoal with a strong hairline and 14px radius, holding every code at once in a five-column grid of 40px chips on brand charcoal (tinted for leave, breakfasts and bar), with nothing hidden behind scrolling. The selected code takes a 2px gold outline. A gold «Готово» button (10px radius, 700) closes it; it is the view's gold action while the brush is open.

### Shift Picker
A dialog (charcoal surface, strong hairline, 22px radius, 420px max, 18px padding) titled with the person's name (19px/700) over the full date (13.5px, text-2), with a circular close button. Codes sit in a two-column grid of 52px options on brand charcoal (12px radius), each a code chip plus label; the current code gets a gold border and a gold check.

### Navigation
- **Desktop sidebar:** charcoal surface with a hairline right edge and the gold wordmark (92px) at the top. Items are 10px-radius rows in text-2. Hover and active states move to brand charcoal with text colour, and the active icon turns gold. No indicator bars or glows.
- **Mobile:** a top bar with a translucent ground and blur, the gold wordmark (68px), a strong-hairline divider, and the page title in Golos 700. The floating bottom bar uses translucent charcoal. The active item gets a gold wash with a gold icon and label, and the central home disc turns solid gold when active.

### States
Loading uses skeleton blocks shaped like the real layout (segment, hero, row, chart) that pulse to 55% over 1.4s, plus a 60% fade on content while refreshing. Empty states are one plain 14px sentence in text-2 that tells the worker what to do next. Every animation and transition is disabled under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** build migrated screens on the `--t-*` tokens and the cash-v3 patterns (hero summary, stat tiles, segmented control, cards, hairline lists, dialog).
- **Do** keep gold for the viewer's money, the single primary action, and the current selection (The Gold Is Earned Rule).
- **Do** show sums with `tabular-nums`, uk-UA grouping and a trailing ₴, and explain each total with its formula directly beneath it.
- **Do** put the primary action within thumb reach above long content, and size touch targets at 36px or more (52px for primary actions).
- **Do** raise elements by stepping up the surface ramp (ground → surface → surface-2 → surface-3) with 1px warm hairlines.
- **Do** pair gain green and loss coral with an arrow, sign or word.
- **Do** use the supplied gold wordmark file as-is in the shell.
- **Do** keep every dialog on the shared ModalRuntime so dialogs centre consistently on phones.
- **Do** mark today and the viewer in tables with the gold haze (gold-wash) in place, keeping the department's order.
- **Do** show every shift code with its letters and a visible legend (The Closed Legend Rule).

### Don't:
- **Don't** add a light theme; the ground is dark only.
- **Don't** add themed ornament (wine, menu, Georgian folklore or other motifs), gradients, glows or patterns.
- **Don't** reintroduce the old green palette, wine accent or Prata, or reference the legacy token names (`--bg`, `--gold`, `--green`, …) in new code.
- **Don't** use more than one gold-filled button in a view, or use gold as a section background.
- **Don't** add drop shadows to cards; the segment-thumb shadow is the only one.
- **Don't** show other people's sums in rankings or shared views; show place and movement.
- **Don't** redraw, re-letter or recolour the Tiflis wordmark beyond the supplied variants.
- **Don't** use the cool bar blue or the shift-code tints outside shift codes.
