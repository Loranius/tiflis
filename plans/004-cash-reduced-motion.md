# 004 — Keep colour feedback on Каса under «reduce motion»

- **Status**: DONE
- **Commit**: 140bcfc
- **Severity**: LOW
- **Category**: Accessibility
- **Estimated scope**: 1 file

## Problem

```css
/* src/pages/cash-v3.css:1032 — current */
@media (prefers-reduced-motion: reduce) {
  .cv3 *,
  .cv3-sheet-backdrop,
  .cv3-sheet {
    animation: none !important;
    transition: none !important;
  }
}
```

This also kills background/colour transitions (button presses, hover, calendar cells). Reduced motion means no movement, not no feedback (DESIGN.md «The Still Rule»: state changes still happen).

## Target

```css
@media (prefers-reduced-motion: reduce) {
  .cv3 *,
  .cv3-sheet-backdrop,
  .cv3-sheet {
    animation: none !important;
  }
  .cv3-bar-fill,
  .cv3-carousel,
  .cv3-primary,
  .cv3-view-toggle {
    transition-property: background, background-color, color, border-color, opacity !important;
  }
  .cv3-primary:active:not(:disabled),
  .cv3-view-toggle:active { transform: none !important; }
}
```

The bars then jump to their new clip immediately, the carousel height snaps, and presses change colour without scaling.

## Steps

1. Replace the block with the target block.

## Verification

- **Feel check**: with reduce motion on (DevTools → Rendering), bars and carousel height change instantly, buttons darken on press without shrinking.
- **Done when**: the block no longer contains `transition: none`.
