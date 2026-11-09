import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Daily job (pg_cron → pg_net → this function): the day before someone's
// birthday, send a Telegram reminder to every active portal user with a linked
// Telegram, except the birthday person themselves.
//
// Not callable from the browser: it is invoked with a shared secret in the
// `x-cron-secret` header (BIRTHDAY_CRON_SECRET), so verify_jwt is off.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
const CRON_SECRET = Deno.env.get("BIRTHDAY_CRON_SECRET") ?? "";
const TIME_ZONE = "Europe/Kyiv";

const POSITION_LABELS: Record<string, string> = {
  admin: "Адміністратор",
  bartender: "Бармен",
  waiter: "Офіціант",
  hostess: "Хостес",
  runner: "Ранер",
  sommelier: "Сомельє",
  head_chef: "Шеф-кухар",
  cook: "Кухар",
  cook_assistant: "Помічник кухаря",
  housekeeping: "Господиня",
  facilities: "Завгосп",
  purchasing: "Закупівник",
};

type BirthdayRow = {
  id: number;
  full_name: string;
  position: string;
  position2: string | null;
  birthday_month: number;
  birthday_day: number;
  user_id: string | null;
};

type UserRow = {
  id: string;
  display_name: string | null;
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

function kyivToday(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses an optional YYYY-MM-DD override for the birthday date (manual runs / testing). */
function parseDateOverride(value: unknown): Date | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "invalid";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || isoDate(date) !== value ? "invalid" : date;
}

function nameKey(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("uk-UA");
}

function positionText(person: BirthdayRow): string {
  return [person.position, person.position2]
    .filter((value): value is string => Boolean(value))
    .map((value) => POSITION_LABELS[value] ?? value)
    .join(" · ");
}

function formatDayMonth(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", timeZone: "UTC" }).format(date);
}

function buildMessage(people: BirthdayRow[], birthdayDate: Date): string {
  const lines = people.map((person) => {
    const position = positionText(person);
    return position ? `• ${person.full_name} (${position})` : `• ${person.full_name}`;
  });
  const heading = people.length === 1
    ? `🎂 Нагадування: завтра, ${formatDayMonth(birthdayDate)}, день народження у колеги:`
    : `🎂 Нагадування: завтра, ${formatDayMonth(birthdayDate)}, день народження у колег:`;
  return [heading, "", ...lines, "", "Не забудьте привітати! 🎉"].join("\n");
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
    if (!response.ok) console.error("Birthday reminder sendMessage failed", { status: response.status });
    return response.ok;
  } catch (error) {
    console.error("Birthday reminder Telegram network error", error);
    return false;
  }
}

/** Is this user the birthday person? Prefer the explicit account link; fall back to the name for unlinked roster rows. */
function isBirthdayPerson(user: UserRow, person: BirthdayRow): boolean {
  if (person.user_id) return person.user_id === user.id;
  const key = nameKey(user.display_name);
  return key !== "" && key === nameKey(person.full_name);
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

  // The reminder goes out today (Kyiv time) for tomorrow's birthdays.
  const today = kyivToday();
  const birthdayDate = override ?? new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  const reminderDate = new Date(birthdayDate.getTime() - 86_400_000);
  const month = birthdayDate.getUTCMonth() + 1;
  const day = birthdayDate.getUTCDate();

  const admin: UntypedSupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 29 February birthdays are celebrated on 1 March in non-leap years.
    const dayFilter = month === 3 && day === 1 && !isLeapYear(birthdayDate.getUTCFullYear())
      ? "and(birthday_month.eq.3,birthday_day.eq.1),and(birthday_month.eq.2,birthday_day.eq.29)"
      : `and(birthday_month.eq.${month},birthday_day.eq.${day})`;
    const birthdaysResult = await admin
      .from("staff_birthdays")
      .select("id,full_name,position,position2,birthday_month,birthday_day,user_id")
      .or(dayFilter)
      .order("full_name", { ascending: true });
    if (birthdaysResult.error) throw birthdaysResult.error;
    const people = (birthdaysResult.data ?? []) as BirthdayRow[];
    if (people.length === 0) {
      return json({ ok: true, birthdayDate: isoDate(birthdayDate), birthdays: 0, sent: 0, skipped: 0 });
    }

    const [usersResult, deliveredResult] = await Promise.all([
      admin.from("users").select("id,display_name,chat_id,tg_id,fired").or("fired.is.null,fired.eq.false"),
      admin
        .from("birthday_reminder_deliveries")
        .select("user_id")
        .eq("reminder_date", isoDate(reminderDate))
        .eq("delivered", true),
    ]);
    if (usersResult.error) throw usersResult.error;
    if (deliveredResult.error) throw deliveredResult.error;
    const alreadyDelivered = new Set(((deliveredResult.data ?? []) as { user_id: string }[]).map((row) => row.user_id));

    let sent = 0;
    let skipped = 0;
    let alreadySent = 0;
    const seenDestinations = new Set<string>();
    const preview: { userId: string; birthdays: number[] }[] = [];

    for (const user of (usersResult.data ?? []) as UserRow[]) {
      const others = people.filter((person) => !isBirthdayPerson(user, person));
      if (others.length === 0) continue; // the only birthday tomorrow is this user's own
      if (alreadyDelivered.has(user.id)) {
        alreadySent += 1;
        continue;
      }
      const destination = user.chat_id || user.tg_id;
      if (!destination || seenDestinations.has(String(destination))) {
        skipped += 1;
        continue;
      }
      seenDestinations.add(String(destination));

      const birthdayIds = others.map((person) => person.id);
      if (dryRun) {
        preview.push({ userId: user.id, birthdays: birthdayIds });
        continue;
      }

      const delivered = await sendTelegram(destination, buildMessage(others, birthdayDate));
      const { error: logError } = await admin.from("birthday_reminder_deliveries").upsert({
        reminder_date: isoDate(reminderDate),
        user_id: user.id,
        birthday_ids: birthdayIds,
        delivered,
      }, { onConflict: "reminder_date,user_id" });
      if (logError) console.error("Birthday reminder log failed", logError);
      if (delivered) sent += 1;
      else skipped += 1;
    }

    return json({
      ok: true,
      dryRun,
      birthdayDate: isoDate(birthdayDate),
      birthdays: people.map((person) => ({ id: person.id, name: person.full_name, linkedUserId: person.user_id })),
      sent,
      skipped,
      alreadySent,
      ...(dryRun ? { preview } : {}),
    });
  } catch (error) {
    console.error("Birthday reminders failed", error);
    return json({ ok: false, error: "Birthday reminders failed" }, 500);
  }
});
