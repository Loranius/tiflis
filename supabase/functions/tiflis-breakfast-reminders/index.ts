import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Daily job (pg_cron → pg_net → this function): at 09:00 Kyiv, every waiter
// whose shift tomorrow is a breakfast shift (СН or СН/Б) gets a Telegram
// reminder. pg_cron fires at 06:00 and 07:00 UTC; the function only acts when
// it is the 9 o'clock hour in Kyiv, so the reminder keeps its local time across
// the summer-time switch.
//
// Not callable from the browser: it is invoked with the shared secret of the
// birthday job in the `x-cron-secret` header (BIRTHDAY_CRON_SECRET), so
// verify_jwt is off.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
const CRON_SECRET = Deno.env.get("BIRTHDAY_CRON_SECRET") ?? "";
const TIME_ZONE = "Europe/Kyiv";
const REMINDER_HOUR = 9;
const BREAKFAST_SHIFTS = new Set(["СН", "СН/Б"]);

type UserRow = {
  id: string;
  display_name: string | null;
  role: string | null;
  role2: string | null;
  chat_id: number | string | null;
  tg_id: number | string | null;
  fired: boolean | null;
};

// deno-lint-ignore no-explicit-any
type UntypedSupabaseClient = any;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function timingSafeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}

function kyivNow(): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseDateOverride(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "invalid";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? "invalid" : value;
}

function isWaiter(user: UserRow): boolean {
  return user.role === "waiter" || user.role2 === "waiter";
}

function formatDayMonth(value: string): string {
  return new Intl.DateTimeFormat("uk-UA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(`${value}T12:00:00Z`));
}

function buildMessage(name: string, shiftDate: string, shift: string): string {
  const withBar = shift === "СН/Б" ? " (сніданки + бар)" : "";
  return [
    `🍳 Нагадування: завтра, ${formatDayMonth(shiftDate)}, ти на сніданках${withBar}.`,
    "",
    `${name}, гарного вечора і до зустрічі зранку!`,
  ].join("\n");
}

async function sendTelegram(destination: number | string, text: string): Promise<boolean> {
  const chatId = Number(destination);
  if (!BOT_TOKEN || !Number.isSafeInteger(chatId)) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!response.ok) console.error("Breakfast reminder sendMessage failed", { status: response.status });
    return response.ok;
  } catch (error) {
    console.error("Breakfast reminder Telegram network error", error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CRON_SECRET) {
    return json({ ok: false, error: "Server configuration error" }, 503);
  }
  if (!timingSafeEqual(req.headers.get("x-cron-secret") ?? "", CRON_SECRET)) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }

  let body: Record<string, unknown> = {};
  try {
    const raw = await req.text();
    if (raw.trim()) body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }
  const dryRun = body.dry_run === true;
  const override = parseDateOverride(body.date);
  if (override === "invalid") return json({ ok: false, error: "Invalid date, expected YYYY-MM-DD" }, 400);

  const now = kyivNow();
  // The cron fires twice (06:00 and 07:00 UTC); only the run that lands at 09:xx Kyiv acts.
  if (!override && !dryRun && now.hour !== REMINDER_HOUR) {
    return json({ ok: true, skipped: "not 09:00 in Kyiv", kyivHour: now.hour });
  }
  const shiftDate = override ?? addDays(now.date, 1);

  const admin: UntypedSupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const [scheduleResult, usersResult, deliveredResult] = await Promise.all([
      admin.from("schedule").select("user_id,shift").eq("date", shiftDate).in("shift", [...BREAKFAST_SHIFTS]),
      admin.from("users").select("id,display_name,role,role2,chat_id,tg_id,fired").or("fired.is.null,fired.eq.false"),
      admin.from("breakfast_reminder_deliveries").select("user_id").eq("shift_date", shiftDate).eq("delivered", true),
    ]);
    if (scheduleResult.error) throw scheduleResult.error;
    if (usersResult.error) throw usersResult.error;
    if (deliveredResult.error) throw deliveredResult.error;

    const shifts = new Map(((scheduleResult.data ?? []) as { user_id: string; shift: string }[])
      .map((row) => [String(row.user_id), String(row.shift).trim()]));
    const alreadyDelivered = new Set(((deliveredResult.data ?? []) as { user_id: string }[]).map((row) => row.user_id));

    let sent = 0;
    let skipped = 0;
    let alreadySent = 0;
    const preview: { userId: string; shift: string }[] = [];

    for (const user of (usersResult.data ?? []) as UserRow[]) {
      const shift = shifts.get(user.id);
      if (!shift || !BREAKFAST_SHIFTS.has(shift) || !isWaiter(user)) continue;
      if (alreadyDelivered.has(user.id)) {
        alreadySent += 1;
        continue;
      }
      const destination = user.chat_id || user.tg_id;
      if (!destination) {
        skipped += 1;
        continue;
      }
      if (dryRun) {
        preview.push({ userId: user.id, shift });
        continue;
      }
      const name = (user.display_name || "").trim().split(/\s+/)[0] || "Привіт";
      const delivered = await sendTelegram(destination, buildMessage(name, shiftDate, shift));
      const { error: logError } = await admin.from("breakfast_reminder_deliveries").upsert({
        shift_date: shiftDate,
        user_id: user.id,
        delivered,
      }, { onConflict: "shift_date,user_id" });
      if (logError) console.error("Breakfast reminder log failed", logError);
      if (delivered) sent += 1;
      else skipped += 1;
    }

    return json({ ok: true, dryRun, shiftDate, sent, skipped, alreadySent, ...(dryRun ? { preview } : {}) });
  } catch (error) {
    console.error("Breakfast reminders failed", error);
    return json({ ok: false, error: "Breakfast reminders failed" }, 500);
  }
});
