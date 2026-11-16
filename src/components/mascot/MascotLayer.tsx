import { useCallback, useEffect, useRef, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { Khinkali } from './Khinkali';
import { tapLine, type Line, type Mood } from './lines';
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

/* ─── The layer ─── */

const BUBBLE_MS = 6000;
const LONG_PRESS_MS = 550;
const FIELD = 'input, textarea, select, [contenteditable="true"]';

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** How far left he may walk from his corner: within the right half of the screen. */
function walkRange(): number {
  const width = window.innerWidth;
  return width >= 981 ? 260 : Math.max(0, width / 2 - 80);
}

/** A modal dialog is open or a form field has focus: step out of the way. */
function shouldStepAway(): boolean {
  if (document.querySelector('[role="dialog"][aria-modal="true"]')) return true;
  const active = document.activeElement;
  return Boolean(active && active instanceof HTMLElement && active.matches(FIELD));
}

/**
 * Хінкалик lives above the bottom navigation, bottom-right. He idles, walks a
 * little every 20–40 s, talks in a bubble (one line at a time, 6 s or until
 * tapped), steps away while a dialog is open or a field is focused, and can be
 * hidden with a long press. Under «reduce motion» he stands still and talks.
 */
export function MascotLayer() {
  const hidden = useMascotHidden();
  const reduce = useReducedMotion() ?? false;
  const [x, setX] = useState(0);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<'left' | 'right'>('left');
  const [away, setAway] = useState(false);
  const [bubble, setBubble] = useState<{ line: Line; id: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [queueTick, setQueueTick] = useState(0);
  const queue = useRef<Line[]>([]);
  const lineId = useRef(0);
  const pressTimer = useRef(0);
  const pressedLong = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useMascotReactions(say, !hidden);

  // Lines from anywhere join the queue.
  useEffect(() => {
    const listener = (line: Line) => {
      queue.current.push(line);
      setQueueTick((tick) => tick + 1);
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  // Show the next line when nothing is being said and he is on screen.
  useEffect(() => {
    if (bubble || away || hidden || !queue.current.length) return;
    const line = queue.current.shift() as Line;
    lineId.current += 1;
    setBubble({ line, id: lineId.current });
  }, [bubble, away, hidden, queueTick]);

  useEffect(() => {
    if (!bubble) return;
    const timer = window.setTimeout(() => setBubble(null), BUBBLE_MS);
    return () => window.clearTimeout(timer);
  }, [bubble]);

  // Step away for dialogs and focused fields.
  useEffect(() => {
    let frame = 0;
    const check = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setAway(shouldStepAway()));
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', check);
    check();
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', check);
    };
  }, []);

  // A line that was showing when he stepped away waits for his return.
  useEffect(() => {
    if (away && bubble) {
      queue.current.unshift(bubble.line);
      setBubble(null);
    }
  }, [away, bubble]);

  // Walk a little every 20–40 s.
  useEffect(() => {
    if (reduce || hidden) return;
    let timer = 0;
    const plan = () => {
      timer = window.setTimeout(() => {
        if (!away && !menuOpen && !document.hidden) {
          const range = walkRange();
          setX((current) => {
            let next = -randomBetween(0, range);
            if (Math.abs(next - current) < 40) next = current > -range / 2 ? -range * 0.8 : 0;
            setFacing(next < current ? 'left' : 'right');
            setWalking(true);
            return next;
          });
        }
        plan();
      }, randomBetween(20_000, 40_000));
    };
    plan();
    return () => window.clearTimeout(timer);
  }, [reduce, hidden, away, menuOpen]);

  // Keep him on screen when the viewport narrows.
  useEffect(() => {
    const onResize = () => setX((current) => Math.max(current, -walkRange()));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close the little menu on any outside press.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);

  const startPress = useCallback(() => {
    pressedLong.current = false;
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      pressedLong.current = true;
      setMenuOpen(true);
    }, LONG_PRESS_MS);
  }, []);

  const endPress = useCallback(() => {
    window.clearTimeout(pressTimer.current);
  }, []);

  const onTap = useCallback(() => {
    if (pressedLong.current) {
      pressedLong.current = false;
      return;
    }
    if (bubble) {
      setBubble(null);
      return;
    }
    say(tapLine(Math.random));
  }, [bubble]);

  if (hidden) return null;

  const mood: Mood = bubble?.line.mood ?? 'neutral';

  return (
    <m.div
      ref={rootRef}
      className="mk-layer"
      initial={false}
      animate={{ transform: away ? 'translateY(160%)' : 'translateY(0%)', opacity: away ? 0 : 1 }}
      transition={{ duration: reduce ? 0 : 0.22, ease: [0.23, 1, 0.32, 1] }}
      aria-hidden={away || undefined}
    >
      <m.div
        className="mk-walker"
        initial={false}
        animate={{ transform: `translateX(${x}px)` }}
        transition={{ duration: reduce ? 0 : 2.4, ease: 'easeInOut' }}
        onAnimationComplete={() => setWalking(false)}
      >
        {bubble ? (
          <button
            key={bubble.id}
            type="button"
            className={`mk-bubble is-${bubble.line.mood}`}
            onClick={() => setBubble(null)}
          >
            {bubble.line.text}
          </button>
        ) : null}
        <div className="mk-live" aria-live="polite">{bubble?.line.text ?? ''}</div>

        {menuOpen ? (
          <div className="mk-menu" role="menu" aria-label="Хінкалик">
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setMascotHidden(true); }}>
              Сховати хінкалика
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className="mk-hit"
          aria-label="Хінкалик. Натисни, щоб він щось сказав; утримуй, щоб сховати."
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onPointerCancel={endPress}
          onContextMenu={(event) => { event.preventDefault(); endPress(); pressedLong.current = true; setMenuOpen(true); }}
          onClick={onTap}
        >
          <Khinkali mood={mood} walking={walking} facing={facing} still={reduce} />
        </button>
      </m.div>
    </m.div>
  );
}
