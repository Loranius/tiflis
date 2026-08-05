import { useEffect } from 'react';

const DIALOG_SELECTOR = '[role="dialog"][aria-modal="true"]';

function isVisible(element: HTMLElement): boolean {
  if (!element.isConnected || element.hidden) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function findBackdrop(dialog: HTMLElement): HTMLElement | null {
  let current = dialog.parentElement;

  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const className = typeof current.className === 'string' ? current.className.toLowerCase() : '';
    const looksLikeBackdrop = className.includes('backdrop') || className.includes('overlay');
    const coversViewport = style.position === 'fixed'
      && (style.inset === '0px' || (style.top === '0px' && style.right === '0px' && style.bottom === '0px' && style.left === '0px'));

    if (looksLikeBackdrop || coversViewport) return current;
    current = current.parentElement;
  }

  return dialog.parentElement;
}

function updateViewportVariables() {
  const viewport = window.visualViewport;
  const height = viewport?.height ?? window.innerHeight;
  const offsetTop = viewport?.offsetTop ?? 0;

  document.documentElement.style.setProperty('--tiflis-modal-viewport-height', `${Math.round(height)}px`);
  document.documentElement.style.setProperty('--tiflis-modal-viewport-top', `${Math.round(offsetTop)}px`);
}

export function ModalRuntime() {
  useEffect(() => {
    let frame = 0;
    let previousFocused: HTMLElement | null = null;
    let activeDialog: HTMLElement | null = null;

    const synchronize = () => {
      frame = 0;
      updateViewportVariables();

      const dialogs = [...document.querySelectorAll<HTMLElement>(DIALOG_SELECTOR)].filter(isVisible);
      const nextDialog = dialogs.at(-1) ?? null;

      dialogs.forEach((dialog) => {
        dialog.classList.add('tiflis-modal-surface');
        dialog.setAttribute('tabindex', dialog.getAttribute('tabindex') || '-1');
        findBackdrop(dialog)?.classList.add('tiflis-modal-backdrop');
      });

      document.body.classList.toggle('tiflis-modal-open', Boolean(nextDialog));

      if (nextDialog && nextDialog !== activeDialog) {
        previousFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        activeDialog = nextDialog;
        window.requestAnimationFrame(() => {
          if (!nextDialog.isConnected) return;
          const autofocus = nextDialog.querySelector<HTMLElement>('[autofocus]');
          (autofocus || nextDialog).focus({ preventScroll: true });
        });
      }

      if (!nextDialog && activeDialog) {
        activeDialog = null;
        const target = previousFocused;
        previousFocused = null;
        if (target?.isConnected) target.focus({ preventScroll: true });
      }
    };

    const scheduleSynchronize = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(synchronize);
    };

    const observer = new MutationObserver(scheduleSynchronize);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-modal', 'hidden', 'open'],
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const dialog = [...document.querySelectorAll<HTMLElement>(DIALOG_SELECTOR)].filter(isVisible).at(-1);
      if (!dialog) return;

      const backdrop = findBackdrop(dialog);
      if (!backdrop) return;
      event.preventDefault();
      backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    };

    updateViewportVariables();
    synchronize();
    window.addEventListener('resize', scheduleSynchronize, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleSynchronize, { passive: true });
    window.visualViewport?.addEventListener('scroll', scheduleSynchronize, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleSynchronize);
      window.visualViewport?.removeEventListener('resize', scheduleSynchronize);
      window.visualViewport?.removeEventListener('scroll', scheduleSynchronize);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('tiflis-modal-open');
      document.documentElement.style.removeProperty('--tiflis-modal-viewport-height');
      document.documentElement.style.removeProperty('--tiflis-modal-viewport-top');
    };
  }, []);

  return null;
}
