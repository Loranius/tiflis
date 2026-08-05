---
name: tiflis-sequential-decisions
description: Use Tiflis Brain MCP for complex planning, debugging, architecture, migrations, risky refactors, and decisions that may require branches or revisions.
---

# Tiflis sequential decisions

Use `tiflis-brain` only when the task is genuinely non-trivial: it affects several modules, has unclear requirements, carries production risk, needs alternatives, or may require revising an earlier assumption.

## Workflow

1. Call `brain_start` with the goal, scope, constraints, and an initial step estimate.
2. Record only concise and user-shareable notes through `brain_step`:
   - hypothesis;
   - evidence;
   - risk;
   - decision;
   - validation;
   - revision.
3. Create a branch when two approaches need separate evaluation.
4. Use `revisesStep` when evidence invalidates an earlier note.
5. Call `brain_review` before changing production code.
6. After tests and visual verification, call `brain_close` with the outcome, validation, remaining risks, and rollback plan.

## Rules

- Never store private chain-of-thought, raw scratchpad, passwords, tokens, personal data, or copied logs containing secrets.
- A useful step states what was concluded, what evidence supports it, and what is checked next.
- Do not manufacture steps to make a simple task look complex.
- Keep active branches limited; merge or reject them as evidence becomes clear.
- A closed session must name concrete validation, not merely say that the change looks correct.
