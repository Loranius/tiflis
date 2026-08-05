# Tiflis MCP Agent Stack

This stack combines project-specific servers with canonical external MCP engines.

## Servers

| Server | Role | Source |
|---|---|---|
| `tiflis-memory` | Local knowledge graph, decisions, and regressions | Tiflis Agent Core |
| `tiflis-brain` | Structured planning, alternatives, revisions, validation | Tiflis Agent Core |
| `serena` | Symbol-level code retrieval, references, refactoring | Serena |
| `playwright` | Accessibility-first persistent browser automation | Microsoft Playwright MCP |
| `tiflis-visual` | Restricted screenshots and mobile visual audits | Tiflis Visual MCP |
| `firecrawl` | Public web search, scrape, extraction, research | Firecrawl hosted MCP |
| `mcp-compass` | Discovery of additional MCP servers | MCP Compass |

## Design decisions

- Serena, Playwright, and Firecrawl are consumed as canonical upstream servers instead of being forked.
- Brain and Memory are local because they need Tiflis-specific privacy, schema, and workflow rules.
- Brain records concise decision summaries, never hidden chain-of-thought.
- Memory files, browser sessions, screenshots, and authentication state stay under `.agent-data` and are never committed.
- Playwright and tiflis-visual overlap intentionally: Playwright provides deterministic accessibility structure; tiflis-visual provides actual rendered images.

## One-time setup

Requirements:

- Node.js 22+
- npm/npx
- `uv`/`uvx` for Serena

Run:

```bash
node tools/tiflis-agent-stack/setup.mjs
```

The script installs both local Tiflis MCP packages and Chromium for the visual server. External servers are started on demand by the MCP client through `.mcp.json`.

## Firecrawl

The shared config uses Firecrawl's hosted keyless endpoint for rate-limited search, scrape, and interact access. For the complete tool set, configure a private API key outside the repository and replace the remote entry with the documented `firecrawl-mcp` stdio command.

## Data paths

```text
.agent-data/tiflis-memory.json
.agent-data/tiflis-brain.json
.agent-data/playwright/
.agent-data/tiflis-browser-state.json
```

## Recommended workflow

1. Recall task context from `tiflis-memory`.
2. Use `tiflis-brain` only for complex or risky work.
3. Navigate code with Serena.
4. Reproduce behavior with Playwright.
5. Inspect layout with tiflis-visual.
6. Use Firecrawl only for relevant public external information.
7. Use MCP Compass only when the stack has a real missing capability.
8. Validate code and browser behavior.
9. Store verified decisions or regressions in memory.

See `.agents/skills/` for the detailed operating rules.
