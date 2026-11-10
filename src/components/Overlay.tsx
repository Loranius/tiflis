import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { playDialogEnter } from '../lib/motion';

/**
 * Renders a dialog into <body> and makes the app shell inert while it is open,
 * so Tab and screen readers cannot leave the dialog. ModalRuntime still handles
 * centring, Escape (a backdrop mousedown) and scroll lock. On open, the sheet
 * rises out of a soft blur (skipped under «reduce motion»).
 */
export function Overlay({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell');
    if (!shell) return;
    shell.inert = true;
    return () => { shell.inert = false; };
  }, []);

  useLayoutEffect(() => {
    const backdrop = root.current?.firstElementChild ?? null;
    playDialogEnter(backdrop, root.current?.querySelector('[role="dialog"]') ?? null);
  }, []);

  return createPortal(<div ref={root} className="tm-contents">{children}</div>, document.body);
}
