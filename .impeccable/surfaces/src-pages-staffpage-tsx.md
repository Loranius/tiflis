---
version: 1
slug: "src-pages-staffpage-tsx"
primary_target: "src/pages/StaffPage.tsx"
related_targets: ["src/pages/staff-v3.css", "src/pages/StaffBirthdaysTab.tsx", "src/pages/staff-birthdays.css", "src/components/Overlay.tsx", "src/lib/photo.ts", "supabase/functions/tiflis-staff-api/index.ts"]
---

# Персонал (src/pages/StaffPage.tsx)

Scope: the staff page. Fifth screen of the portal redesign, inside the established world recorded in DESIGN.md (charcoal + gold classic dashboard, Golos Text). Visitor mode: Look up.

Audience and job: every staff member learns who is who in the team (faces, names, nicknames, roles) and sees colleagues' birthdays; each person keeps their own profile (photo, nick, birthday, socials, credo). Admins add a new employee (account + one-time temporary password), archive or return people, edit roles and reset passwords.

Owner decisions: the page is for «хто є хто» and birthdays; admins mostly add people and archive / return them; staff photos are uploaded from the phone instead of a URL; the birthdays roster stays a separate tab.

## Direction contract

THESIS: The team as a wall of faces grouped by role, with a profile card for each person; it refuses the metric tiles, emoji role icons and technical account badges of the old admin directory.

OWN-WORLD: Inherits DESIGN.md. Gold only for the primary action («Новий працівник», «Зберегти»), the selected chip, and «Це ти» on the viewer's own face. Account state (login, has signed in) is admin-only quiet text. Archive is the DESIGN danger control with a two-tap confirm.

STORY: Open Персонал → Команда; scan faces by group or search → tap a face → profile: photo, role and nick, credo, birthday, tenure, next shift, Telegram / Instagram. Own face → «Редагувати мій профіль» → add a photo from the phone. Admin: «Новий працівник» → form → one-time credentials sheet; profile → reset password or archive. Дні народження tab: roster sorted by the next birthday, the coming week lifted.

FIRST VIEWPORT: Segmented Команда / Дні народження (+ gold «Новий працівник» for admins); search; group chips with «Архів · N» for admins; the first group heading with its count; a grid of square face tiles (two columns on phones).

FORM: surface roll; the owner had fixed the two tabs, so the dealt lead (grouped face wall + profile sheet) ships for Команда and the roster list stays for Дні народження. seed:2ec5771c0792d16a

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
