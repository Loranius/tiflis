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

import { releaseVelocity, stepGlide, type Glide } from '../src/components/mascot/physics.ts';

const box = { width: 56, height: 60 };
const screen = { width: 390, height: 844 };

function glideFor(start: Glide, seconds: number): { state: Glide; bounces: number } {
  let state = start;
  let bounces = 0;
  for (let i = 0; i < seconds * 60; i += 1) {
    const next = stepGlide(state, 1 / 60, box, screen);
    if (next.bounced) bounces += 1;
    state = next.state;
  }
  return { state, bounces };
}

test('a flick glides, slows down by friction and stops within a few seconds', () => {
  const { state } = glideFor({ left: 160, top: 400, vx: 900, vy: -600 }, 4);
  assert.equal(state.vx, 0);
  assert.equal(state.vy, 0);
});

test('it bounces off the screen edges like a billiard ball and stays on screen', () => {
  const { state, bounces } = glideFor({ left: 300, top: 400, vx: 2500, vy: 0 }, 4);
  assert.ok(bounces >= 1, 'bounced');
  assert.ok(state.left >= 8 && state.left <= screen.width - box.width - 8, `left ${state.left}`);
  assert.ok(state.top >= 8 && state.top <= screen.height - box.height - 8);
});

test('a bounce reverses the speed and loses some of it', () => {
  const next = stepGlide({ left: screen.width - box.width - 9, top: 300, vx: 1200, vy: 0 }, 1 / 60, box, screen);
  assert.ok(next.bounced);
  assert.ok(next.state.vx < 0 && Math.abs(next.state.vx) < 1200);
});

test('release velocity comes from the last ~100 ms of the drag; a slow release does not glide', () => {
  const fast = releaseVelocity([{ x: 100, y: 300, t: 1000 }, { x: 140, y: 290, t: 1050 }, { x: 190, y: 280, t: 1100 }]);
  assert.ok(fast && Math.abs(fast.vx - 900) < 1 && Math.abs(fast.vy + 200) < 1);
  assert.equal(releaseVelocity([{ x: 100, y: 300, t: 1000 }, { x: 103, y: 300, t: 1100 }]), null);
  // Samples older than 120 ms before the last one are ignored (the finger paused, then let go).
  assert.equal(releaseVelocity([{ x: 0, y: 0, t: 0 }, { x: 300, y: 0, t: 100 }, { x: 301, y: 0, t: 400 }]), null);
  // Speed is capped.
  const wild = releaseVelocity([{ x: 0, y: 0, t: 0 }, { x: 900, y: 0, t: 20 }]);
  assert.ok(wild && Math.hypot(wild.vx, wild.vy) <= 3000 + 1e-6);
});
