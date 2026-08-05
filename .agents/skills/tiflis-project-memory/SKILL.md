---
name: tiflis-project-memory
description: Retrieve and maintain durable Tiflis project context with the local knowledge graph, decisions, and regression records.
---

# Tiflis project memory

Use `tiflis-memory` to carry verified project knowledge across sessions without repeatedly rereading the entire repository.

## Before work

1. Call `memory_context` with the exact current task.
2. Open named entities with `memory_open_nodes` when the returned context references a module, API, workflow, or invariant.
3. Treat stored memory as a lead, not unquestionable truth. Verify details against current code when they can become stale.

## After work

- Use `memory_remember_decision` for an accepted architecture, security, data-flow, or UX decision.
- Use `memory_remember_bug` only after the symptom, cause, fix, and regression check are known.
- Use `memory_upsert_entities` for stable modules, services, roles, workflows, and important project concepts.
- Use `memory_create_relations` with active-voice relation names such as `uses`, `renders`, `calls`, `protects`, or `depends_on`.
- Use `memory_add_observations` for one atomic fact per observation.

## Rules

- Never store passwords, tokens, session files, customer data, employee cash values, or speculative claims.
- Prefer durable facts over temporary implementation details.
- Mark experimental or superseded decisions correctly instead of silently overwriting history.
- Include affected files and validation commands whenever possible.
- Do not record a visual fix until the post-change page was actually inspected.
