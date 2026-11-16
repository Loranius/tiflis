# Animation plans

Written by the `improve-animations` audit at commit 140bcfc.

| # | Plan | Severity | Status |
|---|---|---|---|
| 006 | One ease-out token | LOW | DONE |
| 001 | Cash bars: clip-path instead of height | MEDIUM | DONE |
| 002 | Cash day dialog through Overlay | MEDIUM | DONE |
| 003 | Perceptible press feedback | MEDIUM | DONE |
| 004 | Keep colour feedback under reduce motion on Каса | LOW | DONE |
| 005 | Menu progress bars: scaleX | LOW | DONE |
| 007 | Cash dialog exit | LOW | DONE |
| 008 | Highlight the saved record | LOW | DONE |

**Order**: 006 first (others use `--t-ease-out`), then 001–005, then 007 (needs 002), then 008.

**Documented trade-offs, not planned** (DESIGN.md → Motion): the 0.42s screen change with a full-page 6px blur, the 0.7s payout roll on period change, and the «Ще» sheet rising 28px. Revisit only if the owner asks.
