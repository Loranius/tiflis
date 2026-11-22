/*
 * Хінкалик's idle acting: which beat to play next, how long each lasts, and
 * where a short stroll goes. No imports beyond types: tested from Node.
 *
 * Craft notes (2d-character-rig-animation skill): beats have anticipation and
 * a settle, he holds still between them (stillness reads), and his legs cycle
 * at a speed that matches how fast he travels, so his feet do not skate.
 */

import type { Mood } from './lines';

export type Beat = 'hop' | 'hop2' | 'sway' | 'shuffle' | 'clap' | 'spin' | 'startle' | 'doze';
export type Act = 'stroll' | 'hop' | 'sway' | 'shuffle' | 'clap' | 'look' | 'spin' | 'startle' | 'doze';
type Rnd = () => number;

/** CSS beat durations, matching mascot.css (`.act-*`). */
export const ACT_MS: Record<Beat, number> = {
  hop: 720,
  hop2: 1440,
  sway: 1600,
  shuffle: 1400,
  clap: 1500,
  spin: 1100,
  startle: 900,
  doze: 4200,
};

/** He walks to a new spot every 20 s (owner, November 2026) and stays there. */
export const STROLL_EVERY_MS = 20_000;

/** Walking speed, px/s: one 0.36 s leg cycle covers about a 12 px stride. */
export const STROLL_SPEED = 34;

/* Beats between walks; strolls have their own 20 s timer. */
const WEIGHTS: Array<[Act, number]> = [
  ['look', 16],
  ['sway', 14],
  ['shuffle', 14],
  ['hop', 14],
  ['clap', 10],
  ['spin', 12],
  ['startle', 8],
  ['doze', 12],
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
 * Where the next walk goes: 60–160 px toward a random side that has room,
 * staying 8 px inside the screen. He stays where he arrives. Null when there is
 * no room for a 60 px walk either way.
 */
export function planStroll(home: { left: number; width: number }, rnd: Rnd): { direction: 'left' | 'right'; distance: number; target: number; ms: number } | null {
  const size = 56;
  const roomLeft = Math.min(160, home.left - 8);
  const roomRight = Math.min(160, home.width - (home.left + size) - 8);
  const sides: Array<'left' | 'right'> = [];
  if (roomLeft >= 60) sides.push('left');
  if (roomRight >= 60) sides.push('right');
  if (!sides.length) return null;
  const direction = sides.length === 2 ? (rnd() < 0.5 ? 'left' : 'right') : sides[0] as 'left' | 'right';
  const room = direction === 'left' ? roomLeft : roomRight;
  const distance = Math.round(60 + rnd() * (room - 60));
  const target = direction === 'left' ? home.left - distance : home.left + distance;
  return { direction, distance, target, ms: (distance / STROLL_SPEED) * 1000 };
}

/** A beat that fits what he just said: claps or hops for joy, a sway when smug. */
export function reactionFor(mood: Mood, rnd: Rnd): Beat | null {
  if (mood === 'happy') return rnd() < 0.5 ? 'clap' : 'hop2';
  if (mood === 'love') return 'spin';
  if (mood === 'surprised') return 'startle';
  if (mood === 'sleepy') return 'doze';
  if (mood === 'smug') return 'sway';
  return null;
}

/** The face a beat wears when nothing is being said. */
export function moodForBeat(beat: Beat | null): Mood | null {
  if (beat === 'spin') return 'love';
  if (beat === 'startle') return 'surprised';
  if (beat === 'doze') return 'sleepy';
  return null;
}
