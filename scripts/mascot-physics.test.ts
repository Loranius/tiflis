import test from 'node:test';
import assert from 'node:assert/strict';
import { clampPosition, stepPendulum, type Pendulum } from '../src/components/mascot/physics.ts';

const rest: Pendulum = { angle: 0, velocity: 0 };
const DT = 1 / 60;

function run(state: Pendulum, accel: number, frames: number, damping: number): Pendulum {
  let s = state;
  for (let i = 0; i < frames; i += 1) s = stepPendulum(s, accel, DT, damping);
  return s;
}

test('hand pulled right swings the body left (positive angle), and the other way', () => {
  assert.ok(run(rest, 3000, 6, 3).angle > 0.02);
  assert.ok(run(rest, -3000, 6, 3).angle < -0.02);
});

test('with no hand motion the swing dies out within a few seconds', () => {
  const swinging: Pendulum = { angle: 0.6, velocity: 0 };
  const after = run(swinging, 0, 60 * 6, 1.2);
  assert.ok(Math.abs(after.angle) < 0.02, `angle ${after.angle}`);
  const stillMoving = run(swinging, 0, 60 * 1, 1.2);
  assert.ok(Math.abs(stillMoving.angle) > 0.05 || Math.abs(stillMoving.velocity) > 0.2, 'still swaying after 1 s');
});

test('the angle never passes ±1.1 rad, even for a violent fling', () => {
  const flung = run(rest, 200000, 30, 0);
  assert.ok(Math.abs(flung.angle) <= 1.1);
});

test('a huge frame gap does not explode', () => {
  const s = stepPendulum({ angle: 0.3, velocity: 2 }, 0, 2, 1.2);
  assert.ok(Number.isFinite(s.angle) && Math.abs(s.angle) <= 1.1);
});

test('positions are kept fully on screen', () => {
  const vp = { width: 390, height: 844 };
  const size = { width: 56, height: 60 };
  assert.deepEqual(clampPosition({ left: -40, top: -10 }, size, vp), { left: 8, top: 8 });
  assert.deepEqual(clampPosition({ left: 999, top: 999 }, size, vp), { left: 390 - 56 - 8, top: 844 - 60 - 8 });
  assert.deepEqual(clampPosition({ left: 100, top: 300 }, size, vp), { left: 100, top: 300 });
});
