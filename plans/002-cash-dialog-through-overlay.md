# 002 — Open the cash day dialog through Overlay like every other dialog

- **Status**: DONE
- **Commit**: 140bcfc
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens
- **Estimated scope**: 3 files

## Problem

Every dialog in the portal is wrapped in `Overlay` (`src/components/Overlay.tsx`), which portals it to `<body>`, makes `.app-shell` inert and plays the shared entrance `playDialogEnter` (sheet rises 28px out of a 6px blur at 0.97 scale over 420ms, curve `cubic-bezier(0.23, 1, 0.32, 1)`; scrim fades 220ms). The cash day editor (`DayEditor` in `src/pages/CashPage.tsx`) is rendered inline and moves on its own CSS keyframes:

```css
/* src/pages/cash-v3.css:767 and :783 — current */
.cv3-sheet-backdrop { … animation: cv3-fade 0.18s ease-out; }
.cv3-sheet { … animation: cv3-rise 0.28s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes cv3-rise { from { transform: translateY(24px); opacity: 0.4; } }
```

So the most-used dialog in the app moves differently from all others, and DESIGN.md's «Dialog» section (0.18s fade, 24px rise over 0.28s) contradicts its «Motion» section (28px, 6px blur, 420ms).

## Target

```tsx
// CashPage.tsx, where the editor renders
{editor ? (
  <Overlay>
    <DayEditor … />
  </Overlay>
) : null}
```

CSS: remove the `animation` lines from `.cv3-sheet-backdrop` and `.cv3-sheet`, and delete `@keyframes cv3-fade` / `cv3-rise` if nothing else uses them. DESIGN.md «Dialog» section: replace «it fades in (0.18s) and rises 24px (0.28s, same curve)» with «it enters as described under Motion → Dialogs».

## Repo conventions to follow

- Exemplar: `src/pages/MenuPage.tsx:301` — `{editor ? <Overlay><Editor … /></Overlay> : null}`.

## Steps

1. Import `Overlay` from `../components/Overlay` in `CashPage.tsx` and wrap `<DayEditor>` in it.
2. Remove the two `animation:` declarations and the unused keyframes in `cash-v3.css`.
3. Check every `.cv3-sheet*`, `.cv3-form`, `.cv3-field`, `.cv3-money-input` selector is not nested under `.cv3 ` (the portal moves the dialog out of `.cv3`). If one is, un-nest it.
4. Edit the DESIGN.md sentence as above.

## Boundaries

- Do NOT change `playDialogEnter` or `Overlay`.
- Do NOT change the editor's fields, focus trap or save/delete logic.

## Verification

- **Mechanical**: typecheck, lint, build pass.
- **Feel check**: open «Внести касу»; the sheet rises out of a blur exactly like opening a dish in Меню. Tab cannot reach the page behind. Fonts and inputs look unchanged.
- **Done when**: no `cv3-rise`/`cv3-fade` animation remains; the dialog DOM sits under `<body>`.
