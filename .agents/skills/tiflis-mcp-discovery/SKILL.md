---
name: tiflis-mcp-discovery
description: Discover and evaluate additional MCP servers only when the current Tiflis agent stack lacks a required capability.
---

# Tiflis MCP discovery

Use `mcp-compass` as a discovery aid, not as an automatic installer or trust authority.

## Query construction

A good discovery request names:

1. the target platform or vendor;
2. the exact operation;
3. transport or runtime constraints;
4. authentication expectations;
5. whether read-only access is sufficient.

Example: `MCP server for read-only GitHub Actions artifact inspection from a Node 22 stdio client`.

## Evaluation checklist

Before recommending or adding a server, verify:

- the canonical repository and publisher;
- recent maintenance and release activity;
- license;
- supported transport;
- authentication and secret handling;
- write/destructive tools;
- filesystem and network scope;
- whether an official server already exists;
- overlap with current GitHub, Serena, Playwright, Firecrawl, Brain, Memory, or visual tools.

## Rules

- Prefer official vendor servers over community wrappers.
- Do not install from a marketplace command without checking the canonical repository.
- Do not auto-enable destructive tools.
- Pin or regularly review versions for production workflows.
- Keep the stack small; reject redundant servers that only increase context and attack surface.
- Add a new server only after documenting the capability gap and expected benefit.
