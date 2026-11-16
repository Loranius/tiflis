# 003 — Make press feedback perceptible

- **Status**: DONE
- **Commit**: 140bcfc
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 6 CSS files, one line each (plus 1 added transition)

## Problem

Primary buttons press to `scale(0.99)` — about 1.5px on a 350px phone button, invisible under a thumb — with weak built-in `ease`:

- `src/pages/cash-v3.css:379` `.cv3-primary:active:not(:disabled) { …; transform: scale(0.99); }` with `transition: background 0.15s ease, transform 0.1s ease;` (:372)
- `src/pages/staff-v3.css:107` `.st3-primary:active…scale(0.99)`, `:116` `.st3-secondary:active…scale(0.99)`; transition at `:97` `background-color 0.15s ease, transform 0.15s ease`
- `src/pages/records-v3.css:384` `.rc3-primary:active…scale(0.99)` — and `.rc3-primary` has **no** transition, so it snaps
- `src/pages/reserve-v3.css:62` `.rv3-primary:active…scale(0.99)`; transition at `:57`
- `src/pages/menu-v3.css:1018–1019` `.mv3-primary/.mv3-secondary:active…scale(0.99)`; transition at `:1015`
- `src/pages/duties-page.css:41` `.duties-page-tab-v1:active { transform: scale(0.99); }`; transition `transform 160ms ease`

## Target

- Buttons: `transform: scale(0.97)`. Full-width duty tabs (54px rows): `scale(0.98)`.
- Every transform transition on these: `transform 160ms var(--t-ease-out)` (`cubic-bezier(0.23, 1, 0.32, 1)`). Background/colour transitions stay `0.15s ease`.
- `.rc3-primary, .rc3-danger` get `transition: background-color 0.15s ease, transform 160ms var(--t-ease-out);`.

## Steps

1. In each listed `:active` rule change `scale(0.99)` → `scale(0.97)` (duties tab → `scale(0.98)`).
2. In each listed transition, replace the `transform …` part with `transform 160ms var(--t-ease-out)`.
3. Add the transition to `.rc3-primary, .rc3-danger` in records-v3.css.

## Boundaries

- Do NOT add press scale to list rows, day cells or chips — colour feedback is enough at that frequency.
- Do NOT touch hover rules.

## Verification

- **Mechanical**: build passes.
- **Feel check**: on a phone, tap «Внести касу», «Зберегти» (Рекорди), «Новий працівник»; each visibly dips and springs back. Release is not slower than press.
- **Done when**: `grep -rn "scale(0.99)" src` returns nothing.
