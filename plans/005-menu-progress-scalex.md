# 005 — Grow menu progress bars with transform, not width

- **Status**: DONE
- **Commit**: 140bcfc
- **Severity**: LOW
- **Category**: Performance
- **Estimated scope**: 2 files

## Problem

```css
/* src/pages/menu-v3.css:213 — current */
.mv3-progress > span { display: block; height: 100%; border-radius: 2px; background: var(--t-gold); transition: width 0.3s ease; }
```
Driven from `src/pages/MenuPage.tsx:540, :582, :599` with `style={{ width: \`…%\` }}`. `width` is layout; built-in `ease` is weak.

## Target

```css
.mv3-progress > span {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 2px;
  background: var(--t-gold);
  transform-origin: left center;
  transition: transform 0.3s var(--t-ease-out);
}
```
TSX at the three sites: `style={{ transform: \`scaleX(${fraction})\` }}` where fraction is the same value divided by 100 (0..1).

The 2px radius will stretch slightly under scaleX; at 4–8px tall bars this is invisible — confirm in the feel check.

## Steps

1. Replace the CSS rule.
2. In MenuPage.tsx change each of the three `width` styles to the `scaleX` form, keeping the same maths (`(deck.index / deck.items.length)`, `total ? known / total : 0`, `done / lesson.items.length`).

## Verification

- **Feel check**: answer cards in Тренажер; the bar grows smoothly from the left. Plan tab bars show the same fill as before.
- **Done when**: no `width` style on `.mv3-progress > span`.
