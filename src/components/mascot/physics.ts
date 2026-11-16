/*
 * Хінкалик held by his top knot is a pendulum hanging from the finger. When
 * the hand accelerates one way, the body lags the other way and then sways
 * back and forth until damping settles it. No imports: tested from Node.
 */

export interface Pendulum {
  /** Radians; positive = the body swings to the left (CSS rotate(+) about the knot). */
  angle: number;
  /** Radians per second. */
  velocity: number;
}

/** Knot to centre of mass, px. */
const LENGTH = 40;
/** «Gravity», px/s²: with LENGTH this gives a ~0.8 s swing period. */
const GRAVITY = 2600;
const MAX_ANGLE = 1.1;
const MAX_STEP = 1 / 120;
const MAX_FRAME = 0.1;

/**
 * One frame of the swing. `handAccel` is the hand's horizontal acceleration in
 * px/s² (positive = speeding up to the right), `damping` per second (≈ 3 while
 * held, ≈ 1.2 after release so it sways a few seconds).
 */
export function stepPendulum(state: Pendulum, handAccel: number, dt: number, damping: number): Pendulum {
  let { angle, velocity } = state;
  let remaining = Math.min(Math.max(dt, 0), MAX_FRAME);
  while (remaining > 0) {
    const step = Math.min(MAX_STEP, remaining);
    remaining -= step;
    const accel = (handAccel / LENGTH) * Math.cos(angle) - (GRAVITY / LENGTH) * Math.sin(angle) - damping * velocity;
    velocity += accel * step;
    angle += velocity * step;
    if (angle > MAX_ANGLE) { angle = MAX_ANGLE; velocity = Math.min(velocity, 0); }
    if (angle < -MAX_ANGLE) { angle = -MAX_ANGLE; velocity = Math.max(velocity, 0); }
  }
  return { angle, velocity };
}

/** True when the swing is too small to see. */
export function isAtRest(state: Pendulum): boolean {
  return Math.abs(state.angle) < 0.004 && Math.abs(state.velocity) < 0.02;
}

/** Keep the mascot box fully on screen with an 8px margin. */
export function clampPosition(
  position: { left: number; top: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const margin = 8;
  return {
    left: Math.round(Math.min(Math.max(position.left, margin), viewport.width - size.width - margin)),
    top: Math.round(Math.min(Math.max(position.top, margin), viewport.height - size.height - margin)),
  };
}

/* ─── Thrown: he slides like a billiard ball, bounces off the edges, stops ─── */

export interface Glide { left: number; top: number; vx: number; vy: number }

/** Rolling friction per second: a hard flick slides 2–3 s. */
const FRICTION = 1.6;
/** Speed kept after hitting a screen edge. */
const RESTITUTION = 0.7;
/** Below this he is standing still, px/s. */
const STOP_SPEED = 25;
const MAX_THROW = 3000;
const MIN_THROW = 200;
const EDGE = 8;

/** One frame of the slide, kept 8px inside the screen. */
export function stepGlide(
  glide: Glide,
  dt: number,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { state: Glide; bounced: boolean } {
  let { left, top, vx, vy } = glide;
  let bounced = false;
  const minLeft = EDGE;
  const maxLeft = viewport.width - size.width - EDGE;
  const minTop = EDGE;
  const maxTop = viewport.height - size.height - EDGE;
  let remaining = Math.min(Math.max(dt, 0), MAX_FRAME);
  while (remaining > 0) {
    const step = Math.min(MAX_STEP, remaining);
    remaining -= step;
    left += vx * step;
    top += vy * step;
    if (left < minLeft) { left = minLeft + (minLeft - left); vx = Math.abs(vx) * RESTITUTION; bounced = true; }
    if (left > maxLeft) { left = maxLeft - (left - maxLeft); vx = -Math.abs(vx) * RESTITUTION; bounced = true; }
    if (top < minTop) { top = minTop + (minTop - top); vy = Math.abs(vy) * RESTITUTION; bounced = true; }
    if (top > maxTop) { top = maxTop - (top - maxTop); vy = -Math.abs(vy) * RESTITUTION; bounced = true; }
    const decay = Math.exp(-FRICTION * step);
    vx *= decay;
    vy *= decay;
  }
  left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft));
  top = Math.min(Math.max(top, minTop), Math.max(minTop, maxTop));
  if (Math.hypot(vx, vy) < STOP_SPEED) { vx = 0; vy = 0; }
  return { state: { left, top, vx, vy }, bounced };
}

export function isGliding(glide: Glide): boolean {
  return glide.vx !== 0 || glide.vy !== 0;
}

/**
 * The throw speed from the last ~120 ms of pointer samples, capped at
 * 3000 px/s; null for a gentle release (under 200 px/s) or a paused finger.
 */
export function releaseVelocity(samples: Array<{ x: number; y: number; t: number }>): { vx: number; vy: number } | null {
  const last = samples[samples.length - 1];
  if (!last) return null;
  const recent = samples.filter((sample) => sample.t >= last.t - 120);
  const first = recent[0];
  if (!first || recent.length < 2 || last.t - first.t < 8) return null;
  const seconds = (last.t - first.t) / 1000;
  let vx = (last.x - first.x) / seconds;
  let vy = (last.y - first.y) / seconds;
  const speed = Math.hypot(vx, vy);
  if (speed < MIN_THROW) return null;
  if (speed > MAX_THROW) { vx *= MAX_THROW / speed; vy *= MAX_THROW / speed; }
  return { vx, vy };
}
