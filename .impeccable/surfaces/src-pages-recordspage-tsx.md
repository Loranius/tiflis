---
version: 1
slug: "src-pages-recordspage-tsx"
primary_target: "src/pages/RecordsPage.tsx"
related_targets: ["src/pages/records-v3.css", "supabase/functions/tiflis-secure-api/index.ts"]
---

# Рекорди (src/pages/RecordsPage.tsx)

Scope: the records page. Seventh screen of the portal redesign, inside the established world recorded in DESIGN.md. Visitor mode: Look up / Compete.

Audience and job: waiters see who holds each restaurant record and how far they are from it; admins look at any waiter. The live monthly race already lives on Каса → Топ каси.

Owner decisions: the page is for competition between waiters and a hall of fame; manual records (tips, plates at once, tables at once) stay and waiters enter their own; the board covers waiters only; exact sums of others stay visible.

## Direction contract

THESIS: A hall of fame — one plaque per record with its holder large — plus a personal view that turns every record into a distance («до рекорду …»); it refuses the duplicated grid of eyebrowed cards and the second «топ» that competes with Каса.

OWN-WORLD: Inherits DESIGN.md. Gold for the record-holder trophy, the viewer's own name / place, the «Рекорд ресторану» badge, the primary «Зберегти» and the link to the live race. Values in tabular figures; no medals or podium colours.

STORY: Open Рекорди → Дошка слави: scan plaques, see who holds each record and where you stand → Мої рекорди: your value, «N місце з M» or «Рекорд ресторану», and the gap → for a manual record, «Внести» → value + date → «Зберегти». «Хто лідирує цього місяця — у Касі» jumps to the live race.

FIRST VIEWPORT: Segmented Дошка слави / Мої рекорди; the gold link to Каса · Топ; the first plaque (Каса за місяць) with the holder large and places 2–5.

FORM: surface roll; the owner fixed the purpose (competition + hall of fame) and kept the manual records, so the dealt lead (plaque grid + personal distance list) ships. seed:dac89d242a5516fe

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
