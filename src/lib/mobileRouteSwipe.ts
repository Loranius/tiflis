type SwipeAxis = 'pending' | 'horizontal' | 'vertical';

interface PointerSwipeGesture {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startedAt: number;
  axis: SwipeAxis;
  blocked: boolean;
  surface: HTMLElement;
}

const MOBILE_BREAKPOINT = 980;
const EDGE_GUARD = 24;
const DIRECTION_LOCK = 10;
const MAX_DURATION = 1000;
const LEGACY_ROUTE_ORDER = [
  '/today',
  '/schedule',
  '/cash',
  '/staff',
  '/menu',
  '/reserve',
  '/duties',
  '/handover',
  '/admin',
] as const;

let installed = false;

function routeFromHref(rawHref: string | null): string | null {
  if (!rawHref) return null;

  const hashIndex = rawHref.indexOf('#');
  const candidate = hashIndex >= 0 ? rawHref.slice(hashIndex + 1) : rawHref;
  const path = candidate.split('?')[0] ?? '';
  return path.startsWith('/') ? path : null;
}

function currentRoute(): string {
  const route = window.location.hash.replace(/^#/, '').split('?')[0] ?? '';
  return route.startsWith('/') ? route : '/today';
}

function accessibleRoutes(): Set<string> {
  return new Set(
    Array.from(document.querySelectorAll<HTMLAnchorElement>('.sidebar-nav a[href]'))
      .map((anchor) => routeFromHref(anchor.getAttribute('href')))
      .filter((route): route is string => Boolean(route)),
  );
}

function mobileRouteOrder(): string[] {
  const accessible = accessibleRoutes();
  const ordered: string[] = [];

  const add = (route: string | undefined) => {
    if (route && accessible.has(route) && !ordered.includes(route)) ordered.push(route);
  };

  add('/schedule');
  add(['/cash', '/reserve', '/staff'].find((route) => accessible.has(route)));
  add('/today');
  add('/menu');
  LEGACY_ROUTE_ORDER.forEach(add);

  return ordered;
}

function blocksRouteSwipe(target: EventTarget | null, boundary: HTMLElement): boolean {
  if (!(target instanceof Element)) return true;

  const blockingTarget = target.closest([
    'input',
    'textarea',
    'select',
    '[contenteditable="true"]',
    '[role="dialog"]',
    '.mobile-more-sheet',
    '[data-route-swipe-lock="true"]',
    '.route-swipe-lock',
  ].join(','));

  return blockingTarget !== null && boundary.contains(blockingTarget);
}

function navigateToRoute(route: string) {
  const links = document.querySelectorAll<HTMLAnchorElement>('.sidebar-nav a[href], .mobile-nav a[href], .mobile-more-links a[href]');
  const matchingLink = Array.from(links).find(
    (link) => routeFromHref(link.getAttribute('href')) === route,
  );

  if (matchingLink) {
    matchingLink.click();
    return;
  }

  window.location.hash = route;
}

export function installMobileRouteSwipe() {
  if (installed || typeof window === 'undefined' || !('PointerEvent' in window)) return;
  installed = true;

  let gesture: PointerSwipeGesture | null = null;
  let suppressLegacyTouchUntil = 0;
  let suppressClickUntil = 0;

  const resetGesture = () => {
    if (gesture) {
      try {
        if (gesture.surface.hasPointerCapture(gesture.pointerId)) {
          gesture.surface.releasePointerCapture(gesture.pointerId);
        }
      } catch {
        // Pointer capture is optional; route navigation must still work without it.
      }
    }
    gesture = null;
  };

  const onPointerDown = (event: PointerEvent) => {
    resetGesture();

    if (
      window.innerWidth > MOBILE_BREAKPOINT
      || event.pointerType === 'mouse'
      || !event.isPrimary
      || event.button !== 0
    ) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const surface = target.closest<HTMLElement>('.route-swipe-surface');
    if (!surface) return;

    const startsAtSystemEdge = event.clientX <= EDGE_GUARD
      || event.clientX >= window.innerWidth - EDGE_GUARD;

    gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      startedAt: performance.now(),
      axis: 'pending',
      blocked: startsAtSystemEdge || blocksRouteSwipe(target, surface),
      surface,
    };
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.blocked) return;

    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;

    const deltaX = gesture.lastX - gesture.startX;
    const deltaY = gesture.lastY - gesture.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (gesture.axis === 'pending' && Math.max(absX, absY) >= DIRECTION_LOCK) {
      if (absX > absY * 1.05) {
        gesture.axis = 'horizontal';
        try {
          gesture.surface.setPointerCapture(event.pointerId);
        } catch {
          // Some WebViews reject pointer capture; window listeners still own the gesture.
        }
      } else if (absY > absX * 1.05) {
        gesture.axis = 'vertical';
        gesture.blocked = true;
      }
    }

    if (gesture.axis === 'horizontal') {
      if (event.cancelable) event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  const finishPointerGesture = (event: PointerEvent) => {
    const activeGesture = gesture;
    if (!activeGesture || activeGesture.pointerId !== event.pointerId) return;

    activeGesture.lastX = event.clientX;
    activeGesture.lastY = event.clientY;

    if (activeGesture.axis === 'horizontal') {
      const deltaX = activeGesture.lastX - activeGesture.startX;
      const deltaY = activeGesture.lastY - activeGesture.startY;
      const absX = Math.abs(deltaX);
      const elapsed = Math.max(1, performance.now() - activeGesture.startedAt);
      const velocity = absX / elapsed;
      const minimumDistance = Math.min(72, Math.max(42, window.innerWidth * 0.105));
      const deliberateFlick = absX >= 30 && velocity >= 0.35;

      suppressLegacyTouchUntil = performance.now() + 750;
      suppressClickUntil = performance.now() + 700;

      if (
        elapsed <= MAX_DURATION
        && (absX >= minimumDistance || deliberateFlick)
        && absX >= Math.abs(deltaY) * 1.12
      ) {
        const order = mobileRouteOrder();
        const index = order.indexOf(currentRoute());
        const nextIndex = index + (deltaX < 0 ? 1 : -1);
        const nextRoute = index >= 0 ? order[nextIndex] : undefined;

        if (nextRoute) {
          navigateToRoute(nextRoute);
          window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
        }
      }

      if (event.cancelable) event.preventDefault();
      event.stopImmediatePropagation();
    }

    resetGesture();
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.axis === 'horizontal') suppressLegacyTouchUntil = performance.now() + 300;
    resetGesture();
  };

  const stopLegacyTouchMove = (event: TouchEvent) => {
    if (gesture?.axis !== 'horizontal') return;
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  };

  const stopLegacyTouchEnd = (event: TouchEvent) => {
    if (gesture?.axis !== 'horizontal' && performance.now() >= suppressLegacyTouchUntil) return;
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  };

  const stopGhostClick = (event: MouseEvent) => {
    if (performance.now() >= suppressClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
  window.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
  window.addEventListener('pointerup', finishPointerGesture, { capture: true, passive: false });
  window.addEventListener('pointercancel', onPointerCancel, { capture: true, passive: true });
  window.addEventListener('touchmove', stopLegacyTouchMove, { capture: true, passive: false });
  window.addEventListener('touchend', stopLegacyTouchEnd, { capture: true, passive: false });
  window.addEventListener('click', stopGhostClick, true);
}
