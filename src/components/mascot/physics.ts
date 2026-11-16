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
