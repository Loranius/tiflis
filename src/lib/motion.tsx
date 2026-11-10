import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  LazyMotion,
  MotionConfig,
  animate,
  domMax,
  m,
  useReducedMotion,
  type Transition,
} from 'motion/react';

/**
 * Tiflis motion vocabulary. One place for every spring and timing so the whole
 * portal moves with one hand: production-smooth springs without overshoot for
 * everyday UI, a little bounce only for rare celebrations.
 */
export const spring = {
  /** Screens, cards, sheets: smooth deceleration, no overshoot. */
  settle: { type: 'spring', duration: 0.42, bounce: 0 } satisfies Transition,
  /** The gold pill that travels between nav items and segments. */
  glide: { type: 'spring', duration: 0.38, bounce: 0.12 } satisfies Transition,
  /** Celebrations only (records, birthdays): a visible, friendly overshoot. */
  pop: { type: 'spring', duration: 0.55, bounce: 0.42 } satisfies Transition,
} as const;

export const ease = {
  out: [0.23, 1, 0.32, 1] as const,
  in: [0.55, 0, 1, 0.45] as const,
};

/** Wraps the app: loads the motion features once and honours «reduce motion». */
export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user" transition={spring.settle}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function storage(kind: 'session' | 'local'): Storage | null {
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * True the first time `key` is seen in this scope, false afterwards. Expressive
 * moments (the logo intro, a birthday burst) play once, so the shift's tenth
 * visit to Home is calm. `scope: 'day'` resets every calendar day.
 */
export function useFirstTime(key: string, scope: 'session' | 'day' = 'session'): boolean {
  const [first] = useState(() => {
    // «Reduce motion» users never get the expressive moments.
    if (prefersReducedMotion()) return false;
    const store = storage(scope === 'session' ? 'session' : 'local');
    const stamp = scope === 'day' ? new Date().toDateString() : '1';
    const storageKey = `tiflis:motion:${key}`;
    try {
      if (store?.getItem(storageKey) === stamp) return false;
      store?.setItem(storageKey, stamp);
    } catch {
      // Blocked storage: play the moment; it is decorative.
    }
    return true;
  });
  return first;
}

/** A number that rolls up to its value when it first appears or changes. */
export function CountUp({
  value,
  format,
  duration = 0.7,
}: {
  value: number;
  format: (value: number) => string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);
  const formatRef = useRef(format);
  formatRef.current = format;
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const show = (latest: number) => {
      // Whole numbers while rolling; the exact value on the last frame.
      node.textContent = formatRef.current(latest === value ? value : Math.round(latest));
    };
    if (reduce || !Number.isFinite(value)) {
      show(value);
      previous.current = value;
      return;
    }
    const controls = animate(previous.current, value, { duration, ease: ease.out, onUpdate: show });
    previous.current = value;
    return () => controls.stop();
  }, [value, duration, reduce]);

  // The final value is rendered for screen readers and no-JS snapshots.
  return <span ref={ref}>{format(value)}</span>;
}

const BURST_COLORS = ['#D1B46B', '#E9D39B', '#B8954B', '#F4EEE2'];

/**
 * A one-shot burst of gold confetti from the centre of its parent. Pure
 * decoration: aria-hidden, skipped entirely under «reduce motion».
 */
export function GoldBurst({ count = 18 }: { count?: number }) {
  const reduce = useReducedMotion();
  const [pieces] = useState(() => Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + Math.random() * 0.4;
    const distance = 46 + Math.random() * 46;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 18,
      rotate: Math.random() * 300 - 150,
      color: BURST_COLORS[index % BURST_COLORS.length],
      round: index % 3 === 0,
      delay: Math.random() * 0.08,
    };
  }));
  if (reduce) return null;
  return (
    <span className="tm-burst" aria-hidden="true">
      {pieces.map((piece, index) => (
        <m.i
          key={index}
          className={piece.round ? 'is-round' : undefined}
          style={{ background: piece.color }}
          initial={{ x: 0, y: 0, scale: 0.6, opacity: 1, rotate: 0 }}
          animate={{ x: piece.x, y: [0, piece.y, piece.y + 34], scale: 1, opacity: [1, 1, 0], rotate: piece.rotate }}
          transition={{ duration: 1.1, delay: piece.delay, ease: ease.out, times: [0, 0.55, 1] }}
        />
      ))}
    </span>
  );
}


/**
 * Plays the dialog entrance: the backdrop fades in, the sheet rises 28px out
 * of a soft blur. It uses the independent `translate`/`scale` properties
 * through the Web Animations API because the shared modal CSS pins
 * `transform: none !important` on phones.
 */
export function playDialogEnter(backdrop: Element | null, dialog: Element | null) {
  if (prefersReducedMotion()) return;
  const curve = `cubic-bezier(${ease.out.join(',')})`;
  backdrop?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'linear' });
  dialog?.animate?.(
    [
      { opacity: 0, translate: '0 28px', scale: '0.97', filter: 'blur(6px)' },
      { opacity: 1, translate: '0 0', scale: '1', filter: 'blur(0px)' },
    ],
    { duration: 420, easing: curve },
  );
}

/**
 * The raised thumb of a segmented control. Render it inside the selected
 * segment; it glides between segments of the same `group` (shared layout).
 */
export function SegThumb({ group }: { group: string }) {
  return <m.span layoutId={`tm-seg-${group}`} className="tm-seg-thumb" aria-hidden="true" transition={spring.glide} />;
}

/** The gold underline of a tab row; it glides to the selected tab. */
export function TabLine({ group }: { group: string }) {
  return <m.span layoutId={`tm-tab-${group}`} className="tm-tab-line" aria-hidden="true" transition={spring.glide} />;
}
