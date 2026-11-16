# Khinkali Mascot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A drawn khinkali that lives above the bottom nav, walks, and reacts in a speech bubble to the viewer's cash, breakfast shifts, shift count, random dishes and random roasts.

**Architecture:** Pure phrase/rule module (`lines.ts`, no imports, unit-tested with `node --test`), an SVG character component with poses (`Khinkali.tsx`), and one layer component (`MascotLayer.tsx`) mounted once in `AppShell` that owns placement, walking, the bubble queue, hiding and data. The cash screen announces saves with a window event; schedule and menu data come through the existing `secureApi` cache.

**Tech Stack:** React 19 + TypeScript, `motion/react` (already loaded through `LazyMotion`/`m`), plain CSS with `--t-*` tokens, Node 22 `node --experimental-strip-types --test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-11-16-khinkali-mascot-design.md`

## Global Constraints

- Ukrainian copy, addressing the viewer with «ти». Harsh teasing only about cash, laziness and shifts; never appearance, health, family, ethnicity.
- Cash verdict: ≥ +25% over the viewer's own month average → `high`; ≤ −25% → `low`; otherwise `normal`; no average (first cash of the month) → `first`.
- Shift verdict: working days ≤ 8 → `lazy`; ≥ 18 → `hard`; otherwise `normal`. A working day is any non-empty shift code except `Х` and `О`.
- Breakfast shifts: `СН`, `СН/Б` (tomorrow, Kyiv date).
- Unprompted lines (dish, roast): at most once per 4 minutes, only after 20 s without input. Daily lines (breakfast, shift count): once per Kyiv day each, keyed in localStorage.
- Bubble: one at a time, 5–7 s (6 s default) or until tapped; later lines queue.
- Walk: every 20–40 s, within the right half of the viewport; never over the nav buttons, a dialog or a focused input.
- Hidden while any `[role="dialog"][aria-modal="true"]` is in the DOM or an `input`/`textarea`/`select` is focused.
- «reduce motion»: no walking/bobbing/blink; it stands still and still talks.
- Never shows other people's money: only the viewer's own cash; when an admin saves someone else's cash, no cash reaction.
- No new server function, table, dependency or sound. Not on the login screen.
- Storage: every `localStorage` access wrapped in try/catch.

## Review Focus

- **Empty or failed data** (menu has no items, schedule request fails, no cash yet): the mascot must stay and keep talking its other lines, never throw — test `dishLine` with an empty description and `pickDish([])` returning null.
- **Month boundary**: on the last day of a month «tomorrow» is in the next month's schedule — `tomorrowKey('2026-11-30') === '2026-12-01'` test, and the layer fetches the next month's schedule in that case.
- **Average with zero or one entry**: `judgeCash(5000, 0)` and `judgeCash(5000, null)` → `first`.
- **Hidden state survives reload and blocked storage**: hide → reload → still hidden; with storage throwing, the mascot shows and hiding works for the session.
- **Repeated lines**: `pick` never returns the same index twice in a row for pools of 2+.

---

### Task 1: Phrase pools and rules (`lines.ts`)

**Files:**
- Create: `src/components/mascot/lines.ts`
- Create: `scripts/mascot-lines.test.ts`
- Modify: `package.json` (script `"test": "node --experimental-strip-types --test scripts/*.test.ts"`)

**Interfaces:**
- Produces (all exported from `lines.ts`, file has **no imports**):
  - `type Mood = 'happy' | 'neutral' | 'sad' | 'smug'`
  - `interface Line { text: string; mood: Mood }`
  - `type Rnd = () => number` (0 ≤ x < 1)
  - `judgeCash(amount: number, monthAverage: number | null): 'high' | 'normal' | 'low' | 'first'`
  - `countWorkDays(shifts: Array<string | null | undefined>): number`
  - `shiftVerdict(workDays: number): 'lazy' | 'normal' | 'hard'`
  - `isBreakfastShift(code: string | null | undefined): boolean`
  - `tomorrowKey(dateKey: string): string` (YYYY-MM-DD in, YYYY-MM-DD out)
  - `pick<T>(pool: readonly T[], rnd: Rnd, avoid?: number): { item: T; index: number }`
  - `cashLine(verdict, amount: number, average: number | null, rnd: Rnd): Line`
  - `shiftLine(verdict, workDays: number, offDays: number, rnd: Rnd): Line`
  - `breakfastLine(code: string, rnd: Rnd): Line`
  - `dishLine(name: string, description: string | null, rnd: Rnd): Line`
  - `pickDish<T extends { name: string; description: string | null }>(items: readonly T[], rnd: Rnd): T | null`
  - `roastLine(rnd: Rnd): Line`, `tapLine(rnd: Rnd): Line`, `greetingLine(rnd: Rnd): Line`
  - `formatHryvnia(value: number): string` → `"7 400 ₴"` (uk-UA grouping, no decimals)

- [ ] **Step 1: Write the failing tests** in `scripts/mascot-lines.test.ts` (import from `'../src/components/mascot/lines.ts'`):

```ts
test('judgeCash thresholds', () => {
  assert.equal(judgeCash(7500, 6000), 'high');   // +25%
  assert.equal(judgeCash(7499, 6000), 'normal');
  assert.equal(judgeCash(4500, 6000), 'low');    // −25%
  assert.equal(judgeCash(4501, 6000), 'normal');
  assert.equal(judgeCash(5000, null), 'first');
  assert.equal(judgeCash(5000, 0), 'first');
});
test('shift counting', () => {
  assert.equal(countWorkDays(['Р', 'Х', 'О', '', null, 'СН', 'С/Б', 'Д']), 4);
  assert.equal(shiftVerdict(8), 'lazy');
  assert.equal(shiftVerdict(9), 'normal');
  assert.equal(shiftVerdict(17), 'normal');
  assert.equal(shiftVerdict(18), 'hard');
});
test('breakfast and dates', () => {
  assert.ok(isBreakfastShift('СН') && isBreakfastShift('СН/Б'));
  assert.ok(!isBreakfastShift('Р') && !isBreakfastShift(null));
  assert.equal(tomorrowKey('2026-11-30'), '2026-12-01');
  assert.equal(tomorrowKey('2026-12-31'), '2027-01-01');
});
test('pick avoids the previous index', () => {
  for (let i = 0; i < 50; i += 1) assert.notEqual(pick(['a', 'b'], Math.random, 0).index, 0);
  assert.equal(pick(['only'], Math.random, 0).item, 'only');
});
test('lines carry numbers and moods', () => {
  const rnd = () => 0;
  assert.match(cashLine('high', 7400, 5000, rnd).text, /7 400/);
  assert.equal(cashLine('high', 7400, 5000, rnd).mood, 'happy');
  assert.equal(cashLine('low', 2000, 5000, rnd).mood, 'sad');
  assert.match(shiftLine('lazy', 6, 24, rnd).text, /6/);
  assert.match(dishLine('Хачапурі по-аджарськи', null, rnd).text, /Хачапурі/);
  assert.ok(dishLine('Х', 'Перше речення. Друге речення.', rnd).text.length <= 220);
  assert.equal(pickDish([], rnd), null);
});
test('every pool line is non-empty Ukrainian text', () => {
  for (let i = 0; i < 40; i += 1) {
    const r = Math.random;
    for (const line of [roastLine(r), tapLine(r), greetingLine(r), breakfastLine('СН', r)]) assert.ok(line.text.trim().length > 3);
  }
});
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement `lines.ts`.** Pools: 15–25 lines each for cash `high`/`normal`/`low`/`first`, shift `lazy`/`normal`/`hard`, breakfast, roast, tap; 6–10 greeting and dish-intro templates. Templates use `{amount}`, `{average}`, `{days}`, `{off}`, `{dish}`, `{about}` placeholders filled by a local `fill`. `dishLine` takes the first sentence of the description (split on `. ` / `! ` / `? `), trims to 120 chars with `…`. `pick` with `avoid` re-rolls to the next index when it would repeat. Moods: cash high → happy, low → sad, normal/first → neutral; lazy → smug, hard → happy, roast → smug, breakfast → neutral.
- [ ] **Step 4: Run** `npm test` — Expected: all pass.
- [ ] **Step 5: Commit** `feat(mascot): phrase pools and rules`.

### Task 2: The khinkali drawing (`Khinkali.tsx`)

**Files:**
- Create: `src/components/mascot/Khinkali.tsx`
- Create: `src/components/mascot/mascot.css`

**Interfaces:**
- Consumes: `Mood` from `./lines`.
- Produces: `Khinkali({ mood, walking, facing, still }: { mood: Mood; walking: boolean; facing: 'left' | 'right'; still: boolean }): JSX.Element` — a 56×60 inline SVG (`viewBox="0 0 56 60"`, `aria-hidden`), classes `mk-body`, `mk-eye`, `mk-mouth`, `mk-leg-l/r`, `mk-arm-l/r`.

- [ ] **Step 1: Draw it.** Cream dough body (`#F1E6CC`, pleat strokes `#D9C7A0`), pleats converging to a twisted knot on top, two dark dot eyes (`#2B2A29`), small mouth path per mood (happy smile, neutral line, sad frown, smug lopsided), soft cheek blush (`rgba(209,180,107,0.45)`), stubby arms and legs (`#E4D3AE`). `facing='left'` mirrors with `scaleX(-1)` on a wrapper `<g>`.
- [ ] **Step 2: Motion in CSS** (`mascot.css`): idle breathing `scaleY(0.98)` on the body every 3.2 s (ease-in-out, transform-origin bottom); blink by `scaleY(0.1)` on eyes every ~4.5 s for 120 ms; walking toggles a class that swings legs ±18° and bobs the body 2px, period 360 ms. All under `@media (prefers-reduced-motion: no-preference)`; `still` disables them. Use `var(--t-ease-out)` for non-loop transitions.
- [ ] **Step 3: Verify** typecheck/lint, then render it on a dev page via the Task 3 layer screenshot (moods side by side are checked there).
- [ ] **Step 4: Commit** `feat(mascot): khinkali drawing and poses`.

### Task 3: The layer (`MascotLayer.tsx`) mounted in AppShell

**Files:**
- Create: `src/components/mascot/MascotLayer.tsx`
- Modify: `src/components/AppShell.tsx` (render `<MascotLayer />` once inside the shell; add «Сховати/Показати хінкалика» row in the «Ще» sheet)
- Modify: `src/components/mascot/mascot.css`

**Interfaces:**
- Consumes: `Khinkali`, everything from `lines.ts`.
- Produces:
  - `MascotLayer(): JSX.Element | null`
  - `say(line: Line): void` — module-level queue entry point, exported for Task 4 (pushes to a listener set the mounted layer subscribes to; no-op when unmounted).
  - `setMascotHidden(hidden: boolean): void`, `useMascotHidden(): boolean` — localStorage key `tiflis.mascot.hidden`, broadcast via a `tiflis:mascot-hidden` window event so the «Ще» row and the layer stay in sync.

- [ ] **Step 1: Placement.** `position: fixed; right: 12px; bottom: calc(var(--mobile-nav-height, 76px) + env(safe-area-inset-bottom) + 6px); z-index` below dialogs (dialogs/ModalRuntime layer must stay above — use 40 if dialogs use ≥ 60). Desktop (≥ 981px): `bottom: 20px; right: 24px`. Read the actual mobile nav height in `legacy-navigation.css`/`mobile-adaptation.css` and use that value.
- [ ] **Step 2: Walking.** A `x` offset (0 to −(50vw − 80px)) animated with `m.div` `animate={{ transform: \`translateX(${x}px)\` }}` (full transform string, not the `x` shorthand), `spring.settle`-like tween `duration: 2.4, ease: 'easeInOut'`; next walk after 20–40 s; `facing` follows direction; `walking` true while moving. Disabled under `useReducedMotion()`.
- [ ] **Step 3: Bubble queue.** One bubble above the mascot (max-width 240px, `var(--t-surface)` background, `1px solid var(--t-line-strong)`, radius 14px, 14px/500 text, tail toward the mascot), shown 6 s or until tapped, enter `opacity 0→1, translateY 6px→0` 180 ms `var(--t-ease-out)`; `aria-live="polite"`. The mascot's mood = the bubble line's mood, back to `neutral` after.
- [ ] **Step 4: Getting out of the way.** A `MutationObserver` on `document.body` (childList, subtree: false is enough for portals) plus `focusin/focusout` listeners: when a modal dialog exists or a form field is focused, slide down `translateY(140%)` 200 ms and hide; return after.
- [ ] **Step 5: Tap and hide.** Tap → `say(tapLine())`. Long-press 550 ms or `contextmenu` → small menu with one button «Сховати хінкалика» → `setMascotHidden(true)`. In the «Ще» sheet, a row toggling the state with label «Сховати хінкалика» / «Показати хінкалика». Hidden → layer renders null.
- [ ] **Step 6: Verify** with the harness (`/tmp/.../scratchpad/harness.cjs`): screenshot `/today` and `/cash` at 390×844 — mascot above nav, not covering it; open «Внести касу» — mascot gone; a forced `say()` shows the bubble. Typecheck, lint, build, `perf:budget` pass (the layer is in the main chunk; keep it under the budget — if over, `React.lazy` it after first idle).
- [ ] **Step 7: Commit** `feat(mascot): layer, walking, bubble, hide`.

### Task 4: Reactions and data

**Files:**
- Modify: `src/components/mascot/MascotLayer.tsx`
- Modify: `src/pages/CashPage.tsx` (dispatch the cash event)

**Interfaces:**
- Consumes: `say`, rules and lines from Tasks 1/3; `secureApi`, `peekSecureApi` from `src/lib/secureApi.ts`; `getKyivDateKey` from `src/lib/time.ts`; `useLocation` from `react-router`.
- Produces: window event `tiflis:cash-saved` with `detail: { amount: number; average: number | null }`.

- [ ] **Step 1: Cash.** In `CashPage.saveDay`, after success and only when `viewingSelf`, compute the average of the viewer's positive `cash` entries this month excluding `next.date` (null if none) and `window.dispatchEvent(new CustomEvent('tiflis:cash-saved', { detail: { amount, average } }))` where `amount = Number(next.cash) || 0`; skip when amount is 0. The layer listens and calls `say(cashLine(judgeCash(amount, average), amount, average, Math.random))` after the dialog closes (the hide/return logic already delays it).
- [ ] **Step 2: Breakfast (daily).** After the layer has been idle-mounted for 8 s, fetch `schedule_bootstrap` for the month of `tomorrowKey(today)` (`peekSecureApi` first, then `secureApi`), find `me.legacyUserId`'s shift for tomorrow; if `isBreakfastShift`, `say(breakfastLine(code))` once per day (key `tiflis.mascot.day.breakfast` = today).
- [ ] **Step 3: Shift count (daily, on `/schedule`).** When the route is the schedule page, use the current month's `schedule_bootstrap`, count the viewer's working days with `countWorkDays`, off days = days in month − working, `say(shiftLine(shiftVerdict(work), work, off))` once per day (key `tiflis.mascot.day.shifts`).
- [ ] **Step 4: Unprompted.** A timer every 60 s: if ≥ 4 min since the last unprompted line and ≥ 20 s since the last `pointerdown/keydown/scroll`, say either `dishLine(pickDish(menu.items))` (fetch `menu_bootstrap` from `'tiflis-menu-api'` once, lazily) or `roastLine()`, 50/50; if no dish, roast.
- [ ] **Step 5: Greeting.** First mount of the session: `say(greetingLine())` after 3 s.
- [ ] **Step 6: Verify** in the harness: save cash on `/cash` → a cash bubble appears after the dialog closes with the amount; with a mock schedule giving СН tomorrow → breakfast bubble; on `/schedule` → shift-count bubble. Failed schedule/menu requests leave the mascot running (no console errors). Typecheck, lint, build, `npm test`.
- [ ] **Step 7: Commit** `feat(mascot): reactions to cash, breakfasts, shifts, dishes`.

### Task 5: Docs and release

**Files:**
- Modify: `PRODUCT.md` (Brand Commitments: «Owner exception (November 2026): маскот Хінкалик» — the mascot is the one allowed themed character, scoped to the mascot layer; the interface stays plain)
- Modify: `DESIGN.md` (a «Mascot» component section: size, place, bubble style, motion, reduce-motion, hide; a line under Motion)

- [ ] **Step 1:** Write both entries.
- [ ] **Step 2:** `npm run -s typecheck && npm run -s lint && npm test && npm run -s build && npm run -s perf:budget && npm run -s smoke:dist` all pass.
- [ ] **Step 3:** Commit, merge into `main`, push, wait for «Tiflis v2 CI» success and `stable-runtime/version.json` `sourceSha` = the main SHA.
