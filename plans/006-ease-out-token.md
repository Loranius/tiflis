# 006 — One ease-out token for the whole portal

- **Status**: DONE
- **Commit**: 140bcfc
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 4 files

## Problem

Three hand-typed ease-out curves that almost match:
- `cubic-bezier(0.16, 1, 0.3, 1)`: `src/pages/menu-v3.css:1022`, `src/pages/cash-v3.css:493, :783, :1077`
- `cubic-bezier(.2, .8, .2, 1)`: `src/route-transitions.css:12, :22, :28`
- `[0.23, 1, 0.32, 1]` in `src/lib/motion.tsx` (`ease.out`) — the documented curve.

`ease.in` (`[0.55, 0, 1, 0.45]`) in `src/lib/motion.tsx` is exported and never used; ease-in has no place on UI.

## Target

In `src/theme/tiflis-theme.css` `:root`:
```css
--t-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
```
Every listed literal becomes `var(--t-ease-out)`. Remove `in` from the `ease` object in motion.tsx.

## Steps

1. Add the token next to the other `--t-*` tokens.
2. Replace each literal listed above with `var(--t-ease-out)` (keep durations).
3. Delete the `in: [0.55, 0, 1, 0.45] as const,` line.

## Verification

- **Mechanical**: `grep -rn "0.16, 1, 0.3, 1\|.2, .8, .2, 1" src` returns nothing; typecheck passes.
- **Feel check**: nav items, cash sheet, menu answer reveal look the same or slightly snappier.
