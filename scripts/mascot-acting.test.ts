import test from 'node:test';
import assert from 'node:assert/strict';
import { ACT_MS, nextActDelay, pickAct, planStroll, reactionFor, STROLL_SPEED } from '../src/components/mascot/acting.ts';

test('acts vary and never repeat back to back', () => {
  let previous = null as ReturnType<typeof pickAct> | null;
  const seen = new Set<string>();
  for (let i = 0; i < 300; i += 1) {
    const act = pickAct(previous, Math.random);
    assert.notEqual(act, previous);
    seen.add(act);
    previous = act;
  }
  for (const act of ['stroll', 'hop', 'sway', 'shuffle', 'clap', 'look']) assert.ok(seen.has(act), act);
});

test('idle pause between acts is 7–16 s', () => {
  assert.equal(nextActDelay(() => 0), 7000);
  assert.ok(nextActDelay(() => 0.9999) <= 16000);
});

test('a stroll stays close to home and on screen', () => {
  // Home bottom-right on a phone: only room to the left.
  const right = planStroll({ left: 322, width: 390 }, () => 0.5);
  assert.ok(right && right.direction === 'left' && right.distance >= 40 && right.distance <= 90);
  // Placed at the left edge: goes right.
  const left = planStroll({ left: 8, width: 390 }, () => 0.5);
  assert.ok(left && left.direction === 'right');
  // No room either way: no stroll.
  assert.equal(planStroll({ left: 20, width: 100 }, () => 0.5), null);
  // Walking time follows the stride speed.
  assert.ok(right && Math.abs(right.ms - (right.distance / STROLL_SPEED) * 1000) < 1);
});

test('beats have durations and moods trigger fitting beats', () => {
  for (const act of ['hop', 'hop2', 'sway', 'shuffle', 'clap'] as const) assert.ok(ACT_MS[act] > 300);
  assert.ok(['clap', 'hop2'].includes(reactionFor('happy', () => 0.2) as string));
  assert.ok(['clap', 'hop2'].includes(reactionFor('happy', () => 0.8) as string));
  assert.equal(reactionFor('smug', () => 0.5), 'sway');
  assert.equal(reactionFor('neutral', () => 0.5), null);
});
