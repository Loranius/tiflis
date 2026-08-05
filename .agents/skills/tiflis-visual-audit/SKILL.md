---
name: tiflis-visual-audit
description: Visually inspect the live Tiflis portal with the tiflis-visual MCP before and after UI work. Use for responsive layout, modal positioning, navigation, image loading, overflow, console errors, and regressions.
---

# Tiflis visual audit

Use the `tiflis-visual` MCP whenever a request depends on how the portal actually renders rather than only on source code.

## Required workflow

1. Start with `tiflis_visual_audit` using `pixel-8-pro` on the relevant page.
2. Read the structural snapshot before choosing selectors.
3. Use `tiflis_click`, `tiflis_fill`, and `tiflis_select` to reproduce the user flow.
4. Capture the exact broken state with `tiflis_screenshot`.
5. Read `tiflis_console` and separate rendering problems from API/runtime failures.
6. Change the code only after the visual failure is reproduced.
7. Re-run the same flow after the change.
8. Check at least these presets when layout changed:
   - `small-phone`
   - `pixel-8-pro`
   - `tablet`
   - `desktop`

## Tiflis-specific expectations

- Prioritize the Pixel 8 Pro viewport: 448 × 998 CSS pixels.
- Verify the Telegram/WebView-safe top and bottom areas.
- Check that bottom navigation never covers content or modal actions.
- Check modals both near the top and bottom of the viewport.
- For menu cards, verify two columns at 360 px and 448 px widths.
- For schedule cells, verify the popover anchors to the clicked cell.
- For cash and leaderboard views, verify names and avatars load without exposing restricted numerical data.

## Safety

- Navigate only to the configured Tiflis and localhost origins.
- Do not add arbitrary JavaScript evaluation.
- Do not place login credentials or storage-state files in the repository.
- Do not report a visual fix as complete until a post-change screenshot is inspected.
