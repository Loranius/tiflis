---
name: tiflis-browser-operator
description: Operate and inspect the live Tiflis portal with official Playwright MCP plus the restricted tiflis-visual screenshot server.
---

# Tiflis browser operator

Use two complementary browser surfaces:

- **Official Playwright MCP** for persistent browser state, accessibility snapshots, deterministic element references, forms, console messages, network inspection, and complex interaction flows.
- **tiflis-visual MCP** for image-first audits, exact screenshots, mobile viewport presets, and visual comparison.

## Workflow

1. Open the live or local Tiflis URL with Playwright.
2. Capture an accessibility snapshot before selecting elements.
3. Reproduce the user's exact path using snapshot references rather than guessed selectors.
4. Read console and page errors when behavior is broken.
5. Use `tiflis_visual_audit` or `tiflis_screenshot` to inspect the rendered result.
6. After changing code, repeat the same path and compare the same viewport.

## Required viewport checks

For layout changes, verify at least:

- 360 × 800 small phone;
- 448 × 998 Pixel 8 Pro;
- 768 × 1024 tablet;
- 1440 × 900 desktop.

## Tiflis checks

- Bottom navigation must not cover actions or content.
- Telegram/WebView safe areas must be respected.
- Modals must remain usable near both viewport edges.
- Menu cards must stay in two columns at 360 px and 448 px.
- Schedule popovers must anchor to the clicked cell.
- Cash screens must not expose restricted numerical data.

## Safety

- Stay on Tiflis, its required backend origins, and localhost.
- Do not upload arbitrary local files.
- Do not use browser evaluation when a normal interaction or snapshot is sufficient.
- Never persist credentials in repository files; authenticated storage state belongs in `.agent-data` only.
