import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { Khinkali } from './Khinkali';
import { dropLine, pickupLine, tapLine, type Line, type Mood } from './lines';
import { clampPosition, isAtRest, stepPendulum, type Pendulum } from './physics';
import { useMascotReactions } from './reactions';
import './mascot.css';

/* ─── Speaking from anywhere ─── */

const listeners = new Set<(line: Line) => void>();

/** Queue a line for Хінкалик. No-op while the layer is not mounted. */
export function say(line: Line): void {
  listeners.forEach((listener) => listener(line));
}

/* ─── Hidden state (per device) ─── */

const HIDDEN_KEY = 'tiflis.mascot.hidden';
const HIDDEN_EVENT = 'tiflis:mascot-hidden';
let hiddenFallback = false; // used when storage is blocked

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1';
  } catch {
    return hiddenFallback;
  }
}

export function setMascotHidden(hidden: boolean): void {
  hiddenFallback = hidden;
  try {
    if (hidden) localStorage.setItem(HIDDEN_KEY, '1');
    else localStorage.removeItem(HIDDEN_KEY);
  } catch {
    /* blocked storage: the choice lasts for this session */
  }
  window.dispatchEvent(new CustomEvent(HIDDEN_EVENT));
}

export function useMascotHidden(): boolean {
  const [hidden, setHidden] = useState(readHidden);
  useEffect(() => {
    const sync = () => setHidden(readHidden());
    window.addEventListener(HIDDEN_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(HIDDEN_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return hidden;
}

/* ─── Where he stands (per device) ─── */

const POSITION_KEY = 'tiflis.mascot.position';
const SIZE = { width: 56, height: 60 };
/** The knot tip in the 56×60 drawing: this is where the finger holds him. */
const KNOT = { x: 28, y: 5 };
type Position = { left: number; top: number };

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

/** Saved as fractions of the viewport so it survives rotation and resizes. */
function readPosition(): Position | null {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { fx?: unknown; fy?: unknown };
    if (typeof saved.fx !== 'number' || typeof saved.fy !== 'number') return null;
    const vp = viewport();
    return clampPosition({ left: saved.fx * vp.width, top: saved.fy * vp.height }, SIZE, vp);
  } catch {
    return null;
  }
}

function savePosition(position: Position | null) {
  try {
    if (!position) localStorage.removeItem(POSITION_KEY);
    else {
      const vp = viewport();
      localStorage.setItem(POSITION_KEY, JSON.stringify({ fx: position.left / vp.width, fy: position.top / vp.height }));
    }
  } catch {
    /* blocked storage: the place lasts for this session */
  }
}

/* ─── The layer ─── */

const BUBBLE_MS = 6000;
/** Lines older than this are dropped instead of played late; at most this many wait. */
const STALE_MS = 60_000;
const QUEUE_MAX = 2;
const LONG_PRESS_MS = 550;
const DRAG_START_PX = 6;
const HELD_DAMPING = 3;
const RELEASED_DAMPING = 1.2;
const FIELD = 'input, textarea, select, [contenteditable="true"]';

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Step out of the way: a visible modal dialog is open (ModalRuntime marks
 * <body data-dialog-open>, visibility-checked), the schedule brush bar is up
 * (it sits where he stands), or a form field has focus.
 */
function shouldStepAway(): boolean {
  if (document.body.hasAttribute('data-dialog-open')) return true;
  if (document.querySelector('.sv3-brush')) return true;
  const active = document.activeElement;
  return Boolean(active && active instanceof HTMLElement && active.matches(FIELD));
}

/**
 * Хінкалик lives above the bottom navigation, bottom-right, or wherever the
 * person put him. He idles, walks a little every 20–40 s, talks in a bubble
 * (one line at a time, 6 s or until tapped), steps away while a dialog is open
 * or a field is focused. Drag him by the knot to move him: his body swings like
 * a pendulum against the hand and keeps swaying a few seconds after he is set
 * down. A long press (or Shift+Enter) opens his menu: put back, hide.
 * Under «reduce motion» he stands still, moves without swinging, and talks.
 */
export function MascotLayer() {
  const hidden = useMascotHidden();
  const reduce = useReducedMotion() ?? false;
  const [position, setPosition] = useState<Position | null>(readPosition);
  const [x, setX] = useState(0);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<'left' | 'right'>('left');
  const [away, setAway] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [bubble, setBubble] = useState<{ line: Line; id: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [queueTick, setQueueTick] = useState(0);
  const queue = useRef<{ line: Line; at: number }[]>([]);
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const busyRef = useRef(false);
  const positionRef = useRef(position);
  positionRef.current = position;
  const xRef = useRef(0);
  xRef.current = x;
  const lineId = useRef(0);
  const pressTimer = useRef(0);
  const suppressClick = useRef(false);
  const press = useRef<{ x: number; y: number; id: number } | null>(null);
  const draggingRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef<HTMLButtonElement>(null);
  const swingRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Pendulum: angle/velocity plus the hand's last x and smoothed velocity.
  const swing = useRef<Pendulum>({ angle: 0, velocity: 0 });
  const hand = useRef({ x: 0, lastX: 0, velocity: 0, lastTime: 0 });
  const frame = useRef(0);

  useMascotReactions(say, !hidden, () => busyRef.current);

  // Lines from anywhere join the queue.
  useEffect(() => {
    const listener = (line: Line) => {
      if (hiddenRef.current) return; // hidden: nothing is saved up for later
      queue.current.push({ line, at: Date.now() });
      if (queue.current.length > QUEUE_MAX) queue.current.splice(0, queue.current.length - QUEUE_MAX);
      setQueueTick((tick) => tick + 1);
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  // Show the next line when nothing is being said and he is on screen.
  useEffect(() => {
    if (bubble || away || hidden) return;
    const now = Date.now();
    queue.current = queue.current.filter((item) => now - item.at < STALE_MS);
    const next = queue.current.shift();
    if (!next) return;
    lineId.current += 1;
    setBubble({ line: next.line, id: lineId.current });
  }, [bubble, away, hidden, queueTick]);

  useEffect(() => {
    if (!bubble) return;
    const timer = window.setTimeout(() => setBubble(null), BUBBLE_MS);
    return () => window.clearTimeout(timer);
  }, [bubble]);

  // Step away for dialogs, the schedule brush and focused fields.
  useEffect(() => {
    let raf = 0;
    const check = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => setAway(shouldStepAway()));
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-dialog-open'] });
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', check);
    check();
    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', check);
    };
  }, []);

  // A line that was showing when he stepped away waits for his return.
  useEffect(() => {
    if (away && bubble) {
      queue.current.unshift({ line: bubble.line, at: Date.now() });
      setBubble(null);
    }
  }, [away, bubble]);

  /** How far left he may walk from where he stands: within the right half of the screen, never off it. */
  const walkRoom = useCallback(() => {
    const width = window.innerWidth;
    const half = width >= 981 ? 260 : Math.max(0, width / 2 - 80);
    const left = position ? position.left : width - (width >= 981 ? 24 : 12) - SIZE.width;
    return Math.max(0, Math.min(half, left - 8));
  }, [position]);

  // Walk a little every 20–40 s.
  useEffect(() => {
    if (reduce || hidden) return;
    let timer = 0;
    const plan = () => {
      timer = window.setTimeout(() => {
        if (!away && !menuOpen && !draggingRef.current && !document.hidden) {
          const room = walkRoom();
          const current = xRef.current;
          let next = -randomBetween(0, room);
          if (Math.abs(next - current) < 40) next = current > -room / 2 ? -room * 0.8 : 0;
          if (Math.abs(next - current) >= 1) {
            setFacing(next < current ? 'left' : 'right');
            setWalking(true);
            setX(next);
          }
        }
        plan();
      }, randomBetween(20_000, 40_000));
    };
    plan();
    return () => window.clearTimeout(timer);
  }, [reduce, hidden, away, menuOpen, walkRoom]);

  // Keep him on screen when the viewport changes.
  useEffect(() => {
    const onResize = () => {
      setPosition(readPosition());
      setX(0);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close the little menu on any outside press; focus its first item when it opens.
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);

  /* ─── The swing ─── */

  const applySwing = useCallback(() => {
    const node = swingRef.current;
    if (node) node.style.transform = swing.current.angle ? `rotate(${swing.current.angle}rad)` : '';
  }, []);

  const runSwing = useCallback(() => {
    if (reduce || frame.current) return;
    hand.current.lastTime = performance.now();
    hand.current.lastX = hand.current.x;
    hand.current.velocity = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - hand.current.lastTime) / 1000));
      hand.current.lastTime = now;
      // Smoothed hand velocity; its change per frame is the pull on the knot.
      const rawVelocity = (hand.current.x - hand.current.lastX) / dt;
      hand.current.lastX = hand.current.x;
      const velocity = hand.current.velocity + (rawVelocity - hand.current.velocity) * 0.35;
      const accel = draggingRef.current ? Math.max(-40_000, Math.min(40_000, (velocity - hand.current.velocity) / dt)) : 0;
      hand.current.velocity = draggingRef.current ? velocity : 0;
      swing.current = stepPendulum(swing.current, accel, dt, draggingRef.current ? HELD_DAMPING : RELEASED_DAMPING);
      applySwing();
      if (!draggingRef.current && isAtRest(swing.current)) {
        swing.current = { angle: 0, velocity: 0 };
        applySwing();
        frame.current = 0;
        return;
      }
      frame.current = window.requestAnimationFrame(tick);
    };
    frame.current = window.requestAnimationFrame(tick);
  }, [reduce, applySwing]);

  useEffect(() => () => window.cancelAnimationFrame(frame.current), []);

  /* ─── Press, drag, tap ─── */

  const moveTo = useCallback((clientX: number, clientY: number) => {
    hand.current.x = clientX;
    const next = clampPosition({ left: clientX - KNOT.x, top: clientY - KNOT.y }, SIZE, viewport());
    positionRef.current = next;
    setPosition(next);
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    press.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    suppressClick.current = false;
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      if (draggingRef.current) return;
      suppressClick.current = true;
      setMenuOpen(true);
    }, LONG_PRESS_MS);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = press.current;
    if (!start || start.id !== event.pointerId) return;
    if (!draggingRef.current) {
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < DRAG_START_PX) return;
      // Picked up: he now hangs by his knot from the finger.
      window.clearTimeout(pressTimer.current);
      draggingRef.current = true;
      suppressClick.current = true;
      setDragging(true);
      setMenuOpen(false);
      setWalking(false);
      setX(0);
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* pointer already gone: keep dragging without capture */ }
      hand.current.x = event.clientX;
      if (Math.random() < 0.5) say(pickupLine(Math.random));
      runSwing();
    }
    moveTo(event.clientX, event.clientY);
  }, [moveTo, runSwing]);

  const endPress = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    window.clearTimeout(pressTimer.current);
    const start = press.current;
    press.current = null;
    if (!start || !draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* not captured */ }
    const placed = positionRef.current ? clampPosition(positionRef.current, SIZE, viewport()) : null;
    setPosition(placed);
    savePosition(placed);
    if (Math.random() < 0.5) say(dropLine(Math.random));
  }, []);

  const onClick = useCallback(() => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (bubble) {
      setBubble(null);
      return;
    }
    say(tapLine(Math.random));
  }, [bubble]);

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ContextMenu' || (event.shiftKey && (event.key === 'Enter' || event.key === 'F10'))) {
      event.preventDefault();
      setMenuOpen(true);
    }
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    hitRef.current?.focus();
  }, []);

  busyRef.current = away || dragging || Boolean(bubble) || queue.current.length > 0;

  // Bubble and menu open toward the roomy side of the screen.
  const [side, setSide] = useState({ left: false, below: false });
  useLayoutEffect(() => {
    const vp = viewport();
    const left = position ? position.left + x : vp.width - SIZE.width;
    const top = position ? position.top : vp.height;
    setSide({ left: left < vp.width / 2 - SIZE.width / 2, below: top < 150 });
  }, [position, x]);

  if (hidden) return null;

  const mood: Mood = dragging && !bubble ? 'sad' : bubble?.line.mood ?? 'neutral';
  const sideClass = `${side.left ? ' is-left' : ''}${side.below ? ' is-below' : ''}`;

  return (
    <m.div
      ref={rootRef}
      className={`mk-layer${dragging ? ' is-dragging' : ''}`}
      style={position ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' } : undefined}
      initial={false}
      animate={{ transform: away ? 'translateY(160%)' : 'translateY(0%)', opacity: away ? 0 : 1 }}
      transition={{ duration: reduce ? 0 : 0.22, ease: [0.23, 1, 0.32, 1] }}
      aria-hidden={away || undefined}
    >
      <m.div
        className="mk-walker"
        initial={false}
        animate={{ transform: `translateX(${x}px)` }}
        transition={{ duration: reduce || dragging ? 0 : 2.4, ease: 'easeInOut' }}
        onAnimationComplete={() => setWalking(false)}
      >
        {bubble ? (
          <button
            key={bubble.id}
            type="button"
            className={`mk-bubble is-${bubble.line.mood}${sideClass}`}
            onClick={() => setBubble(null)}
          >
            {bubble.line.text}
          </button>
        ) : null}
        <div className="mk-live" aria-live="polite">{bubble?.line.text ?? ''}</div>

        {menuOpen ? (
          <div
            ref={menuRef}
            className={`mk-menu${sideClass}`}
            role="menu"
            aria-label="Хінкалик"
            onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); closeMenu(); } }}
          >
            {position ? (
              <button type="button" role="menuitem" onClick={() => { setPosition(null); savePosition(null); setX(0); closeMenu(); }}>
                Повернути на місце
              </button>
            ) : null}
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setMascotHidden(true); }}>
              Сховати хінкалика
            </button>
          </div>
        ) : null}

        <button
          ref={hitRef}
          type="button"
          className="mk-hit"
          aria-label="Хінкалик. Натисни — він щось скаже. Перетягни, щоб поставити деінде. Утримуй або Shift+Enter — меню."
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPress}
          onPointerCancel={endPress}
          onContextMenu={(event) => { event.preventDefault(); window.clearTimeout(pressTimer.current); suppressClick.current = true; setMenuOpen(true); }}
          onKeyDown={onKeyDown}
          onClick={onClick}
        >
          <div ref={swingRef} className="mk-swing">
            <Khinkali mood={mood} walking={walking && !dragging} facing={facing} still={reduce} />
          </div>
        </button>
      </m.div>
    </m.div>
  );
}
