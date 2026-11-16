# 008 — Show where a saved cash record landed

- **Status**: DONE
- **Commit**: 140bcfc
- **Severity**: LOW
- **Category**: Missed opportunities
- **Estimated scope**: 2 files

## Problem

After «Зберегти» in the cash dialog, the «Записи» list re-renders with the new or changed row, and nothing tells the eye which one it is.

## Target

The saved day's row (`.cv3-records li` whose date matches) gets class `is-fresh` for one paint and plays once:
```css
.cv3-records li.is-fresh > button { animation: cv3-fresh 1.2s var(--t-ease-out) both; }
@keyframes cv3-fresh { from { background: var(--t-gold-tint, rgba(209, 180, 107, 0.16)); } to { background: transparent; } }
```
Colour only, no movement, so it stays under reduce motion (it is state feedback). It plays once per save: a `freshDate` state set after a successful save, cleared on the next open of any day.

## Steps

1. `const [freshDate, setFreshDate] = useState<string | null>(null)` in CashPage; after a successful `saveDay` set it to the saved date; `openDay` clears it.
2. Add `className={record.date === freshDate ? 'is-fresh' : undefined}` on the `<li>` and use `key={\`${record.date}-${record.date === freshDate}\`}` so the animation replays for a re-save.
3. Add the CSS and keep it out of the reduce-motion `animation: none` (scope it with `:not(...)` or place after with `!important` under the media query).

## Verification

- **Feel check**: save cash for a day; that row in «Записи» glows gold and fades over ~1s. Nothing else moves.
