import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders a dialog into <body> and makes the app shell inert while it is open,
 * so Tab and screen readers cannot leave the dialog. ModalRuntime still handles
 * centring, Escape (a backdrop mousedown) and scroll lock.
 */
export function Overlay({ children }: { children: ReactNode }) {
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell');
    if (!shell) return;
    shell.inert = true;
    return () => { shell.inert = false; };
  }, []);
  return createPortal(children, document.body);
}
