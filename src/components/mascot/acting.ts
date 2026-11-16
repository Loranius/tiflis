/*
 * Хінкалик's idle acting: which beat to play next, how long each lasts, and
 * where a short stroll goes. No imports beyond types: tested from Node.
 *
 * Craft notes (2d-character-rig-animation skill): beats have anticipation and
 * a settle, he holds still between them (stillness reads), and his legs cycle
 * at a speed that matches how fast he travels, so his feet do not skate.
 */

import type { Mood } from './lines';

export type Beat = 'hop' | 'hop2' | 'sway' | 'shuffle' | 'clap';
export type Act = 'stroll' | 'hop' | 'sway' | 'shuffle' | 'clap' | 'look';
type Rnd = () => number;

/** CSS beat durations, matching mascot.css (`.act-*`). */
export const ACT_MS: Record<Beat, number> = {
  hop: 720,
  hop2: 1440,
  sway: 1600,
  shuffle: 1400,
  clap: 1500,
};

/** Walking speed, px/s: one 0.36 s leg cycle covers about a 12 px stride. */
export const STROLL_SPEED = 34;

const WEIGHTS: Array<[Act, number]> = [
  ['stroll', 30],
  ['look', 15],
  ['sway', 15],
  ['shuffle', 15],
  ['hop', 15],
  ['clap', 10],
];

/** A weighted random act, never the same as the previous one. */
export function pickAct(previous: Act | null, rnd: Rnd): Act {
  const pool = WEIGHTS.filter(([act]) => act !== previous);
  const total = pool.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rnd() * total;
  for (const [act, weight] of pool) {
    roll -= weight;
    if (roll < 0) return act;
  }
  return pool[pool.length - 1]?.[0] ?? 'look';
}

/** Hold still 7–16 s between acts. */
export function nextActDelay(rnd: Rnd): number {
  return Math.round(7000 + rnd() * 9000);
}

/**
 * A short walk away from home and back: 40–90 px toward whichever side has
 * room (the left first, since home is bottom-right), staying 8 px inside the
 * screen. Null when there is no room for a 40 px walk.
 */
export function planStroll(home: { left: number; width: number }, rnd: Rnd): { direction: 'left' | 'right'; distance: number; ms: number } | null {
  const size = 56;
  const roomLeft = Math.min(90, home.left - 8);
  const roomRight = Math.min(90, home.width - (home.left + size) - 8);
  const direction = roomLeft >= 40 ? 'left' : roomRight >= 40 ? 'right' : null;
  if (!direction) return null;
  const room = direction === 'left' ? roomLeft : roomRight;
  const distance = Math.round(40 + rnd() * (room - 40));
  return { direction, distance, ms: (distance / STROLL_SPEED) * 1000 };
}

/** A beat that fits what he just said: claps or hops for joy, a sway when smug. */
export function reactionFor(mood: Mood, rnd: Rnd): Beat | null {
  if (mood === 'happy') return rnd() < 0.5 ? 'clap' : 'hop2';
  if (mood === 'smug') return 'sway';
  return null;
}
