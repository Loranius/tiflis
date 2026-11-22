import test from 'node:test';
import assert from 'node:assert/strict';
import { ACT_MS, nextActDelay, pickAct, planStroll, reactionFor, STROLL_EVERY_MS, STROLL_SPEED } from '../src/components/mascot/acting.ts';

test('acts vary, never repeat back to back, and include the new beats; strolls run on their own timer', () => {
  let previous = null as ReturnType<typeof pickAct> | null;
  const seen = new Set<string>();
  for (let i = 0; i < 600; i += 1) {
    const act = pickAct(previous, Math.random);
    assert.notEqual(act, previous);
    seen.add(act);
    previous = act;
  }
  for (const act of ['hop', 'sway', 'shuffle', 'clap', 'look', 'spin', 'startle', 'doze']) assert.ok(seen.has(act), act);
  assert.ok(!seen.has('stroll'), 'strolls are not random beats');
  assert.equal(STROLL_EVERY_MS, 20000);
});

test('idle pause between acts is 7–16 s', () => {
  assert.equal(nextActDelay(() => 0), 7000);
  assert.ok(nextActDelay(() => 0.9999) <= 16000);
});

test('a stroll goes 60–160 px to a side with room, stays on screen, and is where he stays', () => {
  for (let i = 0; i < 200; i += 1) {
    const plan = planStroll({ left: 160, width: 390 }, Math.random);
    assert.ok(plan, 'room both ways');
    assert.ok(plan.distance >= 60 && plan.distance <= 160, `distance ${plan.distance}`);
    const target = plan.direction === 'left' ? 160 - plan.distance : 160 + plan.distance;
    assert.ok(target >= 8 && target <= 390 - 56 - 8, `target ${target}`);
    assert.equal(plan.target, target);
  }
  // Pressed into the right corner: only left.
  assert.equal(planStroll({ left: 326, width: 390 }, () => 0.5)?.direction, 'left');
  // At the left edge: only right.
  assert.equal(planStroll({ left: 8, width: 390 }, () => 0.5)?.direction, 'right');
  // No room either way.
  assert.equal(planStroll({ left: 20, width: 120 }, () => 0.5), null);
  const any = planStroll({ left: 322, width: 390 }, () => 0.5);
  assert.ok(any && Math.abs(any.ms - (any.distance / STROLL_SPEED) * 1000) < 1);
});

test('beats have durations and moods trigger fitting beats', () => {
  for (const act of ['hop', 'hop2', 'sway', 'shuffle', 'clap', 'spin', 'startle', 'doze'] as const) assert.ok(ACT_MS[act] > 300);
  assert.equal(reactionFor('love', () => 0.5), 'spin');
  assert.equal(reactionFor('surprised', () => 0.5), 'startle');
  assert.equal(reactionFor('sleepy', () => 0.5), 'doze');
  assert.ok(['clap', 'hop2'].includes(reactionFor('happy', () => 0.2) as string));
  assert.ok(['clap', 'hop2'].includes(reactionFor('happy', () => 0.8) as string));
  assert.equal(reactionFor('smug', () => 0.5), 'sway');
  assert.equal(reactionFor('neutral', () => 0.5), null);
});
