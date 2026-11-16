# Хінкалик — маскот порталу

Status: draft for owner approval, 2026-11-16.

## Intent

A small drawn khinkali lives on the portal, walks around on its own and reacts
to what the person does. It adds life and humour to a strict dashboard: it
praises or mocks the day's cash, reminds about breakfast shifts, comments on how
many shifts the person works, sometimes tells about a random dish from the menu,
and sometimes just roasts the user. The owner chose a harsh, teasing voice.

## Goals

- Always present, never in the way: it walks, blinks, idles, and talks in a
  speech bubble.
- Reactions grounded in the viewer's own data:
  - **Cash saved** — compares the saved amount with the person's own average
    cash this month: well above (≥ +25%) praise, around it neutral, well below
    (≤ −25%) disappointment and a jab. The first cash of the month is judged
    against nothing: a neutral line.
  - **Breakfast tomorrow** — if tomorrow's shift is СН or СН/Б, a reminder not
    to oversleep (once per day).
  - **Shift count** — working vs. off days in the current month's schedule:
    few working days (≤ 8) «ледацюга»; many (≥ 18) praise for the work plus a
    joke about fatigue; in between neutral (once per day, on the schedule page).
  - **Random dish** — sometimes names a dish from the menu and quotes a short
    part of its «Склад і подача».
  - **Random roast** — occasionally, unprompted, a harsh joke.
  - **Tap** — says something on demand.
- Lines are templates written by hand, in Ukrainian, using «ти», with numbers
  filled in. No AI service.

## Non-goals

- No new server function, no new table. No one sees anyone else's money: the
  mascot only reads the viewer's own cash.
- No sound. No dialogue or input from the user beyond tap / hide.
- Not on the login screen.

## Anti-goals (failure even if it works)

- Covering a button, the bottom nav, a dialog or an input.
- Talking so often it becomes noise during a shift.
- Jokes about appearance, health, family, ethnicity or anything personal
  beyond work numbers. «Harsh» means teasing about cash, laziness and shifts.

## Constraints

- PRODUCT.md records the owner's «no themed ornament, no Georgian motifs»
  interface rule. The mascot is an explicit owner exception (November 2026),
  recorded in PRODUCT.md like the Records exception, scoped to the mascot only.
- Phone first, one hand, evening light. Dark theme only.
- DESIGN.md motion rules: under «reduce motion» it does not walk or bounce; it
  stands still and still talks (speech is state, not decoration).

## Approaches considered

- **A. Always on screen** (chosen by the owner): lives above the bottom nav,
  walks along the edge, reacts in a bubble.
- B. Appears only on events: runs in, talks, leaves. Calmer, but it does not
  «live» on the site.
- C. Walks only on Home, event visits elsewhere. A compromise with weaker
  presence.

## Design (decided)

- **Look:** an SVG khinkali, about 56×60px: pleated dough body in warm cream
  with the twisted top knot («хвостик»), two dot eyes with blink, small mouth
  that changes with mood (happy / neutral / disappointed / smug), stubby arms and
  legs as separate parts so they can move. Gold accents from the brand palette
  only where needed (a tiny gold outline or cheek).
- **Place:** fixed layer above the page, bottom-right, sitting on top of the
  mobile bottom nav (above it, never overlapping its buttons). On desktop it
  sits in the bottom-right corner of the content area.
- **Behaviour:** idles (breathing, blinking); every 20–40 s walks a short way
  left or right along the bottom edge within the right half of the screen, then
  back; turns to face the direction of travel. The legs step, the body bobs.
- **Bubble:** above the mascot, max ~240px wide, charcoal surface, strong
  hairline, 14px text, tail pointing at it; stays 5–7 s or until tapped; one at
  a time; new lines queue.
- **Getting out of the way:** while any dialog is open (Overlay / role=dialog)
  or an input is focused, it hides (slides down out of view) and returns after.
- **Frequency:** events always speak; unprompted lines (dish, roast) at most
  once per 4 minutes and only while the page is idle; daily lines (breakfast,
  shift count) once per day, keyed in browser storage.
- **Hide:** long-press (or right-click) opens a small menu: «Сховати хінкалика».
  Hidden state is remembered on the device; Settings is not touched. A way back:
  the same toggle in the «Ще» sheet («Показати хінкалика»).
- **Data:** cash from the `cash_bootstrap` response already cached by
  `secureApi`, plus a window event `tiflis:cash-saved` (date, amount) fired by
  the cash screen after a successful save; schedule from `schedule_bootstrap`
  for the current month; dishes from `menu_bootstrap` (menu API). Requests are
  deduped by the existing cache; the mascot only fetches what it needs, lazily,
  after the page is idle.
- **Code:** `src/components/mascot/` — `Khinkali.tsx` (the drawing and its
  poses), `MascotLayer.tsx` (placement, walking, bubble, hide), `lines.ts` (the
  phrase pools and the rules that pick them). Mounted once in `AppShell`.

## Left to the builder

- Exact SVG paths, colours within the brand palette, idle timings.
- Exact wording of the lines (about 15–25 per situation), within the anti-goals.
