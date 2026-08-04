import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
const ALLOWED_ORIGINS = new Set((Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((v) => v.trim()).filter(Boolean));
const MAX_TEXT_LENGTH = 3500;
const TELEGRAM_ACTIONS = new Set(["send_personal", "broadcast"]);
const SCHEDULE_ACTIONS = new Set(["schedule_bootstrap", "schedule_upsert"]);
const ALLOWED_SHIFT_CODES = new Set(["", "Р", "Х", "О", "СН", "Б", "С", "Р/Б", "СН/Б", "Д"]);
const OWN_SCHEDULE_ROLES = new Set(["waiter", "bar", "barman", "bartender", "cook", "chef", "hostess"]);

const WAITER_SHIFT_TYPES = [
  { code: "", label: "Не призначено", tone: "neutral" },
  { code: "Р", label: "Робоча", tone: "work" },
  { code: "Х", label: "Вихідний", tone: "off" },
  { code: "О", label: "Відпустка", tone: "leave" },
  { code: "СН", label: "Сніданки", tone: "breakfast" },
  { code: "Б", label: "Бар", tone: "bar" },
  { code: "С", label: "Позначка С", tone: "neutral" },
  { code: "Р/Б", label: "Робоча + бар", tone: "mixed" },
  { code: "СН/Б", label: "Сніданки + бар", tone: "mixed" },
];
const DEFAULT_SHIFT_TYPES = [
  { code: "", label: "Не призначено", tone: "neutral" },
  { code: "Р", label: "Робоча", tone: "work" },
  { code: "Х", label: "Вихідний", tone: "off" },
  { code: "О", label: "Відпустка", tone: "leave" },
  { code: "Д", label: "Позначка Д", tone: "neutral" },
];

type StaffProfile = { legacy_user_id: string | null; role: string; role2: string | null; active: boolean; can_notify: boolean };
type LegacyStaff = { id: string; login: string; display_name: string | null; role: string; role2: string | null; avatar: string | null; fired: boolean | null };

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? "";
  if (!origin || (ALLOWED_ORIGINS.size && !ALLOWED_ORIGINS.has(origin))) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...corsHeaders(req) },
  });
}

function normalizeRole(role: string | null | undefined): string {
  return role === "barman" || role === "bartender" ? "bar" : role || "staff";
}

function canonicalShift(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  return normalized === "Б/Р" ? "Р/Б" : normalized;
}

function isAdmin(profile: StaffProfile): boolean {
  return profile.active && [profile.role, profile.role2].some((role) => role === "admin" || role === "sysadmin");
}

function canEditOwnSchedule(profile: StaffProfile): boolean {
  return profile.active && [profile.role, profile.role2].some((role) => role ? OWN_SCHEDULE_ROLES.has(role) : false);
}

function canSendNotifications(profile: StaffProfile): boolean {
  return profile.active && (profile.can_notify || isAdmin(profile));
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT_LENGTH) : "";
}

function parseMonth(value: unknown): { month: string; start: string; end: string } | null {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const [yearText = "", monthText = ""] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  return {
    month: value,
    start: new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10),
    end: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10),
  };
}

function parseIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function parseOrder(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 200) : [];
  } catch {
    return [];
  }
}

async function sendTelegram(chatId: number | string, text: string): Promise<void> {
  const numericChatId = Number(chatId);
  if (!BOT_TOKEN) throw new Error("Telegram is not configured");
  if (!Number.isSafeInteger(numericChatId) || !text) throw new Error("Invalid Telegram request");
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: numericChatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!response.ok) throw new Error(`Telegram rejected request: ${response.status}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return json(req, { ok: false, error: "Server configuration error" }, 503);

  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return json(req, { ok: false, error: "Authentication required" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json(req, { ok: false, error: "Invalid session" }, 401);

  const { data: rawProfile, error: profileError } = await userClient
    .from("staff_profiles")
    .select("legacy_user_id,role,role2,active,can_notify")
    .eq("user_id", authData.user.id)
    .single();
  const profile = rawProfile as StaffProfile | null;
  if (profileError || !profile || !profile.active || !profile.legacy_user_id) return json(req, { ok: false, error: "Active staff profile required" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(req, { ok: false, error: "Invalid JSON" }, 400); }
  const action = typeof body.action === "string" ? body.action : "";
  if (!TELEGRAM_ACTIONS.has(action) && !SCHEDULE_ACTIONS.has(action)) return json(req, { ok: false, error: "Unsupported action" }, 400);

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    if (action === "schedule_bootstrap") {
      const range = parseMonth(body.month);
      if (!range) return json(req, { ok: false, error: "Invalid month" }, 400);
      const [usersResult, scheduleResult, settingsResult] = await Promise.all([
        serviceClient.from("users").select("id,login,display_name,role,role2,avatar,fired").or("fired.is.null,fired.eq.false").order("display_name", { ascending: true }),
        serviceClient.from("schedule").select("user_id,date,shift").gte("date", range.start).lt("date", range.end).order("date", { ascending: true }),
        serviceClient.from("settings").select("key,value").like("key", "schedule_order_%"),
      ]);
      if (usersResult.error) throw usersResult.error;
      if (scheduleResult.error) throw scheduleResult.error;
      if (settingsResult.error) throw settingsResult.error;

      const users = ((usersResult.data ?? []) as LegacyStaff[])
        .filter((staff) => staff.role !== "sysadmin" || staff.id === profile.legacy_user_id)
        .map((staff) => ({ id: staff.id, name: staff.display_name || staff.login, role: normalizeRole(staff.role), role2: staff.role2 ? normalizeRole(staff.role2) : null, avatar: staff.avatar }));
      const orders: Record<string, string[]> = {};
      for (const item of settingsResult.data ?? []) {
        const role = normalizeRole(String(item.key).replace(/^schedule_order_/, ""));
        orders[role] = [...new Set([...(orders[role] ?? []), ...parseOrder(item.value)])];
      }
      const entries = (scheduleResult.data ?? []).map((entry) => ({ ...entry, shift: canonicalShift(entry.shift) }));
      return json(req, {
        ok: true,
        month: range.month,
        me: { legacyUserId: profile.legacy_user_id, canEditAll: isAdmin(profile) },
        users,
        entries,
        orders,
        shiftTypes: { waiter: WAITER_SHIFT_TYPES, default: DEFAULT_SHIFT_TYPES },
      });
    }

    if (action === "schedule_upsert") {
      const targetUserId = typeof body.user_id === "string" ? body.user_id.trim().slice(0, 120) : "";
      const date = parseIsoDate(body.date);
      const shift = canonicalShift(body.shift);
      if (!targetUserId || !date || !ALLOWED_SHIFT_CODES.has(shift)) return json(req, { ok: false, error: "Invalid schedule entry" }, 400);
      const ownRow = targetUserId === profile.legacy_user_id;
      if (!isAdmin(profile) && !(ownRow && canEditOwnSchedule(profile))) return json(req, { ok: false, error: "Insufficient permissions" }, 403);

      const { data: target, error: targetError } = await serviceClient.from("users").select("id,fired").eq("id", targetUserId).single();
      if (targetError || !target || target.fired === true) return json(req, { ok: false, error: "Staff member not found" }, 404);

      if (!shift) {
        const { error } = await serviceClient.from("schedule").delete().eq("user_id", targetUserId).eq("date", date);
        if (error) throw error;
      } else {
        const { error } = await serviceClient.from("schedule").upsert({ user_id: targetUserId, date, shift }, { onConflict: "user_id,date" });
        if (error) throw error;
      }
      return json(req, { ok: true, saved: { user_id: targetUserId, date, shift } });
    }

    if (!canSendNotifications(profile)) return json(req, { ok: false, error: "Insufficient permissions" }, 403);
    const text = cleanText(body.text);
    if (!text) return json(req, { ok: false, error: "Message is required" }, 400);
    if (action === "send_personal") {
      await sendTelegram(String(body.chat_id ?? ""), text);
      return json(req, { ok: true });
    }

    const roles = Array.isArray(body.roles) ? body.roles.filter((role): role is string => typeof role === "string").slice(0, 20) : [];
    const { data: users, error: usersError } = await serviceClient.from("users").select("chat_id,tg_id,role,role2,fired").eq("fired", false);
    if (usersError) throw usersError;
    let sent = 0, skipped = 0;
    for (const user of users ?? []) {
      if (roles.length && !roles.includes(user.role) && !roles.includes(user.role2)) continue;
      const destination = user.chat_id || user.tg_id;
      if (!destination) { skipped += 1; continue; }
      await sendTelegram(destination, text);
      sent += 1;
    }
    return json(req, { ok: true, sent, skipped });
  } catch (error) {
    console.error("tiflis-secure-api failed", error);
    return json(req, { ok: false, error: "Operation failed" }, 502);
  }
});
