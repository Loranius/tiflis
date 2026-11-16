# 007 — Let the cash day dialog leave instead of vanishing

- **Status**: DONE
- **Commit**: 140bcfc
- **Severity**: LOW
- **Category**: Missed opportunities
- **Estimated scope**: 2 files
- **Depends on**: 002

## Problem

The «Ще» sheet fades out on close (`exit={{ opacity: 0, transition: { duration: 0.14 } }}` in `src/components/AppShell.tsx`), but the cash day dialog — opened every shift — disappears in one frame on «Зберегти», «Видалити», ✕ and backdrop tap.

## Target

A shared helper in `src/lib/motion.tsx`:
```ts
/** The dialog's exit: a quick fade and 12px drop. Resolves when done (at once under reduce motion). */
export function playDialogExit(backdrop: Element | null, dialog: Element | null): Promise<void> {
  if (prefersReducedMotion()) return Promise.resolve();
  const curve = `cubic-bezier(${ease.out.join(',')})`;
  backdrop?.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'linear', fill: 'forwards' });
  const run = dialog?.animate?.(
    [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 12px' }],
    { duration: 160, easing: curve, fill: 'forwards' },
  );
  return run ? run.finished.then(() => undefined, () => undefined) : Promise.resolve();
}
```
In `DayEditor`, closing (✕, backdrop, after a successful save or delete) first awaits `playDialogExit(backdropEl, sheetEl)`, then calls the parent's close. Exit (160ms) is faster than entry (420ms) — the system's response snaps.

## Steps

1. Add `playDialogExit` below `playDialogEnter`.
2. In CashPage, make the parent's `onSave`/`onDelete` return success, and let DayEditor run the exit then `onClose()`; ✕ and backdrop do the same. Ignore close requests while saving.

## Verification

- **Feel check**: save a day; the sheet drops away quickly, the payout number rolls after it. Backdrop tap does the same. Under reduce motion it closes instantly.
