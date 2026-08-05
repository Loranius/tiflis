# Tiflis Visual MCP

A small, restricted browser-automation MCP server for visually inspecting the live Tiflis portal with Chromium and Playwright.

It is based on the official MCP TypeScript SDK v2 server pattern and the archived MCP Puppeteer reference server, but removes arbitrary JavaScript execution and restricts navigation to an allowlist.

## Tools

- `tiflis_open` — open the portal or an allowed localhost URL.
- `tiflis_screenshot` — return a page or element screenshot as MCP image content.
- `tiflis_click` — click a CSS-selected element and optionally return the resulting screenshot.
- `tiflis_fill` — fill an input without echoing the value into logs.
- `tiflis_select` — choose a native select option.
- `tiflis_snapshot` — return visible text, dialogs, and interactive controls.
- `tiflis_console` — read recent browser console messages and page errors.
- `tiflis_visual_audit` — open a page using a phone, tablet, or desktop preset and return both snapshot and screenshot.
- `tiflis_save_session` — save authenticated browser state when `TIFLIS_STORAGE_STATE` is configured.
- `tiflis_close` — close the browser session.

## Install

```bash
cd tools/tiflis-visual-mcp
npm install
npm run install:browser
npm run check
```

## Run

```bash
npm start
```

The repository root includes `.mcp.json`, so MCP clients that support project configuration can discover it after dependencies are installed.

## Environment variables

```bash
TIFLIS_BASE_URL=https://loranius.github.io/tiflis/
TIFLIS_ALLOWED_ORIGINS=https://loranius.github.io,http://localhost,http://127.0.0.1
TIFLIS_HEADLESS=true
TIFLIS_TIMEOUT_MS=20000
TIFLIS_STORAGE_STATE=/absolute/private/path/tiflis-auth-state.json
```

`TIFLIS_ALLOWED_ORIGINS` is intentionally restrictive. Do not broaden it unless the new origin is trusted.

### Authenticated portal session

1. Set `TIFLIS_HEADLESS=false` and `TIFLIS_STORAGE_STATE` to a private path outside the repository.
2. Start the MCP server.
3. Open the login page and sign in using `tiflis_fill` and `tiflis_click`.
4. Call `tiflis_save_session`.
5. Restart with `TIFLIS_HEADLESS=true`; the saved session will be loaded automatically.

Never commit the storage-state file. It may contain active session cookies.

## Client configuration

Equivalent generic configuration:

```json
{
  "mcpServers": {
    "tiflis-visual": {
      "command": "npm",
      "args": ["--prefix", "tools/tiflis-visual-mcp", "start"],
      "env": {
        "TIFLIS_BASE_URL": "https://loranius.github.io/tiflis/",
        "TIFLIS_ALLOWED_ORIGINS": "https://loranius.github.io,http://localhost,http://127.0.0.1",
        "TIFLIS_HEADLESS": "true"
      }
    }
  }
}
```

On Windows, some MCP clients require `npm.cmd` instead of `npm`.

## ChatGPT connection note

ChatGPT connects to remote MCP servers rather than a local stdio process. A local server therefore needs a supported secure MCP tunnel or a remote Streamable HTTP deployment. Availability also depends on the ChatGPT plan and developer-mode access. The stdio server in this folder is immediately usable in clients such as Claude Code, Cursor, and VS Code MCP; it is also the safe local core for a future remote adapter.

## Security choices

- Only HTTP(S) URLs from `TIFLIS_ALLOWED_ORIGINS` are accepted.
- There is no arbitrary `evaluate` tool.
- Browser launch flags cannot be changed by tool calls.
- Input values are never included in success messages.
- Screenshots and snapshots are read-only observations; clicks and fills remain explicit tools.
