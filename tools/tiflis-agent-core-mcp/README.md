# Tiflis Agent Core MCP

Two project-specific MCP servers share one small codebase:

- **Tiflis Brain MCP** — structured decision sessions with branches, revisions, evidence, risks, validation, and rollback notes.
- **Tiflis Memory MCP** — persistent project knowledge graph plus durable records for decisions and fixed bugs.

The servers are inspired by the official MCP Sequential Thinking and Memory servers, but are intentionally adapted for software work in Tiflis.

## Privacy model

The Brain server is **not** a hidden chain-of-thought recorder. It stores only concise, user-shareable decision summaries, evidence, risks, and conclusions. Both servers redact common credential patterns before writing data.

All data is local and defaults to:

```text
.agent-data/tiflis-brain.json
.agent-data/tiflis-memory.json
```

The `.agent-data` directory must remain git-ignored.

## Install

```bash
cd tools/tiflis-agent-core-mcp
npm install
```

## Run

```bash
npm run brain
npm run memory
```

## Inspect

```bash
npm run inspect:brain
npm run inspect:memory
```

## Brain tools

- `brain_start`
- `brain_step`
- `brain_review`
- `brain_close`
- `brain_list`

Use Brain only for work that benefits from explicit alternatives or revisions: architecture, migrations, risky refactors, production bugs, multi-stage UI redesigns, and unclear requirements.

## Memory tools

- `memory_upsert_entities`
- `memory_create_relations`
- `memory_add_observations`
- `memory_remember_decision`
- `memory_remember_bug`
- `memory_search`
- `memory_context`
- `memory_open_nodes`
- `memory_stats`

Store atomic facts. Prefer one observation per fact. Record a decision or bug only after it has been verified.

## Environment variables

```text
TIFLIS_AGENT_MODE=brain|memory
TIFLIS_BRAIN_FILE=.agent-data/tiflis-brain.json
TIFLIS_MEMORY_FILE=.agent-data/tiflis-memory.json
```

Relative data paths resolve from the repository root.
