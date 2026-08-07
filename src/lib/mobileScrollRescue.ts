const MOBILE_BREAKPOINT = 980;
const DIRECTION_LOCK_PX = 14;
const HORIZONTAL_DOMINANCE = 1.65;

const NATIVE_GESTURE_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[role="dialog"]',
  '[data-route-swipe-lock="true"]',
  '.route-swipe-lock',
  '.mobile-more-sheet',
  '.cash-tabs-v2',
  '.menu-section-tabs-v2',
  '.menu-category-tabs-v2',
  '.admin-tabs-v2',
  '.schedule-role-tabs',
  '.reserve-date-strip-v2',
  '.schedule-table-scroll',
  '.duty-planner-table-wrap-v1',
  '.cash-leaderboard-periods',
].join(',');

type GestureDirection = 'pending' | 'horizontal' | 'vertical';

interface RescueGesture {
  identifier: number;
  startX: number;
  startY: number;
  direction: GestureDirection;
  nativeZone: boolean;
}

type RescueWindow = Window & {
  __TIFLIS_MOBILE_SCROLL_RESCUE__?: boolean;
};

function findTouch(list: TouchList, identifier: number): Touch | null {
  for (let index = 0; index < list.length; index += 1) {
    const touch = list.item(index);
    if (touch?.identifier === identifier) return touch;
  }
  return null;
}

/**
 * Protect native page scrolling from the route-swipe listener in AppShell.
 *
 * This listener is installed before React mounts, so it sees touchmove first.
 * Ambiguous/vertical gestures stay fully native and never reach the legacy
 * route-swipe handler that may call preventDefault(). Strongly horizontal
 * gestures are allowed through, preserving intentional route swipes.
 */
export function installMobileScrollRescue() {
  const rescueWindow = window as RescueWindow;
  if (rescueWindow.__TIFLIS_MOBILE_SCROLL_RESCUE__) return;
  rescueWindow.__TIFLIS_MOBILE_SCROLL_RESCUE__ = true;

  let gesture: RescueGesture | null = null;

  const reset = () => {
    gesture = null;
  };

  const onTouchStart = (event: TouchEvent) => {
    reset();
    if (window.innerWidth > MOBILE_BREAKPOINT || event.touches.length !== 1) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('.route-swipe-surface')) return;

    const touch = event.touches.item(0);
    if (!touch) return;

    gesture = {
      identifier: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      direction: 'pending',
      nativeZone: Boolean(target.closest(NATIVE_GESTURE_SELECTOR)),
    };
  };

  const onTouchMove = (event: TouchEvent) => {
    if (!gesture) return;

    const touch = findTouch(event.touches, gesture.identifier);
    if (!touch) return;

    // Editors, horizontal strips and data tables own their gestures completely.
    if (gesture.nativeZone) {
      event.stopImmediatePropagation();
      return;
    }

    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (gesture.direction === 'pending') {
      // Do not let AppShell classify tiny finger jitter as a horizontal route swipe.
      if (Math.max(absX, absY) < DIRECTION_LOCK_PX) {
        event.stopImmediatePropagation();
        return;
      }

      if (absX >= absY * HORIZONTAL_DOMINANCE) {
        gesture.direction = 'horizontal';
      } else {
        // Ambiguous gestures deliberately favour native vertical page scrolling.
        gesture.direction = 'vertical';
      }
    }

    if (gesture.direction === 'vertical') {
      // stopPropagation does not cancel the browser default; the page remains scrollable.
      event.stopImmediatePropagation();
    }
  };

  window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
  window.addEventListener('touchmove', onTouchMove, { capture: true, passive: true });
  window.addEventListener('touchend', reset, { capture: true, passive: true });
  window.addEventListener('touchcancel', reset, { capture: true, passive: true });
}
