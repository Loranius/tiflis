# 001 — Animate the cash chart bars with clip-path instead of height

- **Status**: DONE
- **Commit**: 140bcfc
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 2 files, ~10 lines

## Problem

Every bar of «Каса по днях» animates `height`, a layout property. Switching the period (1–14 / 15–end / Місяць) or any data refresh re-lays out 15–31 bars every frame for 350ms.

```css
/* src/pages/cash-v3.css:487 — current */
.cv3-bar-fill {
  position: relative;
  z-index: 1;
  width: 100%;
  border-radius: 6px 6px 3px 3px;
  background: #5A5751;
  transition: background 0.15s ease, height 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
```

```tsx
// src/pages/CashPage.tsx (chart, inside days.map) — current
<span className="cv3-bar-track"><span className="cv3-bar-fill" style={{ height: `${height}%` }} /></span>
```

## Target

The fill is always full height; how much of it shows is a `clip-path: inset()` from the top, with the rounded corners kept by `round`. clip-path is composited, so no layout.

```css
.cv3-bar-fill {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  border-radius: 6px 6px 3px 3px;
  background: #5A5751;
  transition: background 0.15s ease, clip-path 0.35s var(--t-ease-out);
}
```

```tsx
<span className="cv3-bar-fill" style={{ clipPath: `inset(${100 - height}% 0 0 0 round 6px 6px 3px 3px)` }} />
```

`--t-ease-out` is `cubic-bezier(0.23, 1, 0.32, 1)` (plan 006 adds it; if 006 is not done yet, use the literal).

## Repo conventions to follow

- Timing tokens live on `:root` in `src/theme/tiflis-theme.css` (`--t-*`).
- The day calendar pane in the same file already avoids layout-driven motion.

## Steps

1. In `src/pages/cash-v3.css`, replace the `.cv3-bar-fill` rule with the target rule.
2. In `src/pages/CashPage.tsx`, replace the fill's `style={{ height: … }}` with the `clipPath` style above. Keep the `height` variable computation (0 for empty days → `inset(100% …)`, fully hidden).

## Boundaries

- Do NOT change `.cv3-bar-track` (its 3px zero line must still show under empty days).
- Do NOT change bar colours, hover or best-day styles.

## Verification

- **Mechanical**: `npm run -s typecheck && npm run -s lint && npm run -s build` pass.
- **Feel check**: on Каса → Огляд switch 1–14 → 15–кінець → Місяць; bars grow/shrink from the baseline with rounded tops intact, no squashed corners. At 10% playback the top edge stays round throughout.
- **Done when**: no `height` transition remains on `.cv3-bar-fill`; empty days show only the zero line.
