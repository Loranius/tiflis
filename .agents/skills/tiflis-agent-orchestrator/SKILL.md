---
name: tiflis-agent-orchestrator
description: Coordinate memory, structured decisions, Serena, Playwright, visual inspection, Firecrawl, and MCP discovery for Tiflis tasks.
---

# Tiflis agent orchestrator

Use the smallest combination of tools that can verify the task.

## Default order

1. **Recall** — call `memory_context` for related decisions, modules, and regressions.
2. **Plan only when needed** — open a Brain session for risky, unclear, or multi-stage work.
3. **Understand code** — use Serena symbol retrieval and reference analysis.
4. **Reproduce** — use Playwright for the actual browser flow and console state.
5. **Inspect visually** — use tiflis-visual for screenshots and responsive verification.
6. **Research externally** — use Firecrawl only for current public information or external documentation not available through primary project sources.
7. **Discover tools** — use MCP Compass only when a real capability gap remains.
8. **Validate** — run repository checks and repeat the browser path.
9. **Remember** — store verified decisions or regressions in Tiflis Memory and close any Brain session.

## Tool routing

- Simple known code edit: Serena → tests.
- UI defect: Memory → Playwright → tiflis-visual → Serena/CSS → repeat screenshots → Memory.
- API/data defect: Memory → Serena callers and Edge Function → logs/tests → Memory.
- Architecture change: Memory → Brain branches → Serena references → tests → Brain close → Memory decision.
- Current external integration: Firecrawl or official docs → Brain when alternatives exist → implementation.
- Missing capability: MCP Compass → security/maintenance review → explicit setup decision.

## Efficiency rules

- Do not load every MCP tool for every task.
- Do not use Brain for one-line fixes.
- Do not read entire files when Serena can retrieve a symbol.
- Do not use screenshots as a substitute for accessibility snapshots, or snapshots as a substitute for actual visual review.
- Do not crawl the web when one known page is sufficient.
- Do not write memory before verification.
