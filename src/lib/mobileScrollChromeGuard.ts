const MOBILE_BREAKPOINT = 980;

type AddEventListener = typeof window.addEventListener;

type GuardedWindow = Window & {
  __TIFLIS_CHROMIUM_TOUCH_GUARD__?: boolean;
};

/**
 * Chromium/Android guard for the legacy route-swipe listener.
 *
 * AppShell registers a capture-phase touchmove listener with passive:false and
 * may call preventDefault() while deciding whether a gesture is horizontal.
 * Chrome and Android WebView can then cancel native vertical scrolling.
 *
 * Force window-level capture touchmove listeners to stay passive on mobile so
 * browser scrolling always wins. This does not block pointer/click handlers or
 * element-level touch interactions; it only prevents global window listeners
 * from cancelling the browser's native pan.
 */
export function installMobileScrollChromeGuard() {
  const guardedWindow = window as GuardedWindow;
  if (guardedWindow.__TIFLIS_CHROMIUM_TOUCH_GUARD__) return;
  guardedWindow.__TIFLIS_CHROMIUM_TOUCH_GUARD__ = true;

  const originalAddEventListener: AddEventListener = window.addEventListener.bind(window);

  window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
    if (
      type === 'touchmove'
      && window.innerWidth <= MOBILE_BREAKPOINT
      && typeof options === 'object'
      && options?.capture === true
      && options?.passive === false
    ) {
      return originalAddEventListener(type, listener as EventListenerOrEventListenerObject, {
        ...options,
        passive: true,
      });
    }

    return originalAddEventListener(type, listener as EventListenerOrEventListenerObject, options);
  }) as AddEventListener;
}
