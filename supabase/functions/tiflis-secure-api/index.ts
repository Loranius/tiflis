import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
const ALLOWED_ORIGINS = new Set((Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean));
const MAX_TEXT_LENGTH = 3500;
const TELEGRAM_ACTIONS = new Set(["send_personal", "broadcast"]);
const SCHEDULE_ACTIONS = new Set(["schedule_bootstrap", "schedule_upsert"]);
const CASH_ACTIONS = new Set(["cash_bootstrap", "cash_save_day", "cash_delete_day", "rating_update"]);
const ALLOWED_SHIFT_CODES = new Set(["", "Р", "Х", "О", "СН", "Б", "С", "Р/Б", "СН/Б", "Д"]);
const OWN_SCHEDULE_ROLES = new Set(["waiter", "bar", "barman", "bartender", "cook", "chef", "hostess"]);
const CASH_ROLES = new Set(["waiter", "bar", "barman", "bartender"]);
const RATING_ROLES = new Set(["waiter", "bar", "barman", "bartender", "hostess"]);

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

type StaffProfile = {
  legacy_user_id: string | null;
  role: string;
  role2: string | null;
  active: boolean;
  can_notify: boolean;
};

type LegacyStaff = {
  id: string;
  login: string;
  display_name: string | null;
  role: string;
  role2: string | null;
  avatar: string | null;
  fired: boolean | null;
};

type CashRow = {
  id: number;
  user_id: string | null;
  date: string;
  cash: number | string | null;
  tips: number | string | null;
  first_cash: number | string | null;
};

type ExtraWageRow = {
  id: number;
  user_id: string | null;
  date: string;
  amount: number | string | null;
  description: string | null;
};

type RatingRow = {
  user_id: string | null;
  score: number | null;
};

type RatingCommentRow = {
  id: number;
  user_id: string | null;
  author: string;
  delta: number | null;
  comment: string | null;
  text: string | null;
  created_at: string | null;
};

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
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...corsHeaders(req),
    },
  });
}

function normalizeRole(role: string | null | undefined): string {
  return role === "barman" || role === "bartender" ? "bar" : role || "staff";
}

function staffRoles(staff: Pick<LegacyStaff, "role" | "role2">): string[] {
  return [normalizeRole(staff.role), normalizeRole(staff.role2)].filter((role, index, all) => Boolean(role) && all.indexOf(role) === index);
}

function profileRoles(profile: StaffProfile): string[] {
  return [normalizeRole(profile.role), normalizeRole(profile.role2)].filter((role, index, all) => Boolean(role) && all.indexOf(role) === index);
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

function canUseCash(profile: StaffProfile): boolean {
  return profile.active && (isAdmin(profile) || profileRoles(profile).some((role) => CASH_ROLES.has(role)));
}

function canSendNotifications(profile: StaffProfile): boolean {
  return profile.active && (profile.can_notify || isAdmin(profile));
}

function isCashStaff(staff: LegacyStaff): boolean {
  return staffRoles(staff).some((role) => CASH_ROLES.has(role));
}

function isRatingStaff(staff: LegacyStaff): boolean {
  return staffRoles(staff).some((role) => RATING_ROLES.has(role));
}

function cleanText(value: unknown, maxLength = MAX_TEXT_LENGTH): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function numberOf(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMoney(value: unknown, max: number): number | null {
  const normalized = typeof value === "string" ? value.replace(",", ".").trim() : value;
  const parsed = normalized === "" || normalized === null || normalized === undefined ? 0 : Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return null;
  return Math.round(parsed * 100) / 100;
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
  try {
    body = await req.json();
  } catch {
    return json(req, { ok: false, error: "Invalid JSON" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!TELEGRAM_ACTIONS.has(action) && !SCHEDULE_ACTIONS.has(action) && !CASH_ACTIONS.has(action)) {
    return json(req, { ok: false, error: "Unsupported action" }, 400);
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

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
        .map((staff) => ({
          id: staff.id,
          name: staff.display_name || staff.login,
          role: normalizeRole(staff.role),
          role2: staff.role2 ? normalizeRole(staff.role2) : null,
          avatar: staff.avatar,
        }));
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

    if (action === "cash_bootstrap") {
      if (!canUseCash(profile)) return json(req, { ok: false, error: "Cash access denied" }, 403);
      const range = parseMonth(body.month);
      if (!range) return json(req, { ok: false, error: "Invalid month" }, 400);

      const rawLeaderboardPeriod = typeof body.leaderboard_period === "string" ? body.leaderboard_period : "first";
      const leaderboardPeriod = ["first", "second", "month", "year"].includes(rawLeaderboardPeriod)
        ? rawLeaderboardPeriod
        : "first";
      const [yearText = "", monthText = ""] = range.month.split("-");
      const selectedYear = Number(yearText);
      const selectedMonth = Number(monthText);
      const monthLastDay = new Date(Date.UTC(selectedYear, selectedMonth, 0)).getUTCDate();
      const isoForDay = (day: number) => `${range.month}-${String(day).padStart(2, "0")}`;
      const leaderboardStart = leaderboardPeriod === "year" ? `${selectedYear}-01-01` : range.start;
      const leaderboardEnd = leaderboardPeriod === "year" ? `${selectedYear + 1}-01-01` : range.end;

      const usersResult = await serviceClient
        .from("users")
        .select("id,login,display_name,role,role2,avatar,fired")
        .or("fired.is.null,fired.eq.false")
        .order("display_name", { ascending: true });
      if (usersResult.error) throw usersResult.error;
      const allUsers = (usersResult.data ?? []) as LegacyStaff[];
      const currentStaff = allUsers.find((staff) => staff.id === profile.legacy_user_id);
      if (!currentStaff) return json(req, { ok: false, error: "Staff member not found" }, 404);

      const requestedUserId = typeof body.user_id === "string" ? body.user_id.trim().slice(0, 120) : "";
      const requestedStaff = allUsers.find((staff) => staff.id === requestedUserId);
      const viewStaff = isAdmin(profile) && requestedStaff ? requestedStaff : currentStaff;

      const [cashResult, extrasResult, leaderboardCashResult, leaderboardExtrasResult, ratingsResult, commentsResult] = await Promise.all([
        serviceClient.from("cash").select("id,user_id,date,cash,tips,first_cash").gte("date", range.start).lt("date", range.end).order("date", { ascending: true }),
        serviceClient.from("extra_wages").select("id,user_id,date,amount,description").eq("user_id", viewStaff.id).gte("date", range.start).lt("date", range.end).order("date", { ascending: true }),
        serviceClient.from("cash").select("id,user_id,date,cash,tips,first_cash").gte("date", leaderboardStart).lt("date", leaderboardEnd).order("date", { ascending: true }),
        serviceClient.from("extra_wages").select("id,user_id,date,amount,description").gte("date", leaderboardStart).lt("date", leaderboardEnd).order("date", { ascending: true }),
        serviceClient.from("ratings").select("user_id,score"),
        serviceClient.from("rating_comments").select("id,user_id,author,delta,comment,text,created_at").order("created_at", { ascending: false }).limit(200),
      ]);
      if (cashResult.error) throw cashResult.error;
      if (extrasResult.error) throw extrasResult.error;
      if (leaderboardCashResult.error) throw leaderboardCashResult.error;
      if (leaderboardExtrasResult.error) throw leaderboardExtrasResult.error;
      if (ratingsResult.error) throw ratingsResult.error;
      if (commentsResult.error) throw commentsResult.error;

      const cashRows = (cashResult.data ?? []) as CashRow[];
      const leaderboardCashRows = (leaderboardCashResult.data ?? []) as CashRow[];
      const leaderboardExtraRows = (leaderboardExtrasResult.data ?? []) as ExtraWageRow[];
      const cashStaff = allUsers.filter(isCashStaff);
      const selectorUsers = isAdmin(profile)
        ? [...new Map([...cashStaff, currentStaff].map((staff) => [staff.id, staff])).values()]
        : [currentStaff];

      const includeCashDate = (date: string): boolean => {
        if (leaderboardPeriod === "first") return date >= isoForDay(1) && date <= isoForDay(Math.min(14, monthLastDay));
        if (leaderboardPeriod === "second") return date >= isoForDay(Math.min(15, monthLastDay)) && date < range.end;
        return true;
      };
      const includeBaseDate = (date: string): boolean => {
        if (leaderboardPeriod === "first") return date >= isoForDay(1) && date <= isoForDay(Math.min(15, monthLastDay));
        if (leaderboardPeriod === "second") return date >= isoForDay(Math.min(16, monthLastDay)) && date < range.end;
        return true;
      };
      const includeExtraDate = includeBaseDate;

      const totals = cashStaff.map((staff) => {
        const staffCashRows = leaderboardCashRows.filter((row) => row.user_id === staff.id);
        const cashForPercent = staffCashRows
          .filter((row) => includeCashDate(row.date))
          .reduce((sum, row) => sum + numberOf(row.first_cash ?? row.cash), 0);
        const workDays = staffCashRows.filter((row) => {
          return includeBaseDate(row.date) && (numberOf(row.cash) > 0 || numberOf(row.tips) > 0);
        }).length;
        const extras = leaderboardExtraRows
          .filter((row) => row.user_id === staff.id && includeExtraDate(row.date))
          .reduce((sum, row) => sum + numberOf(row.amount), 0);
        return { staff, total: cashForPercent * 0.04 + workDays * 200 + extras };
      }).sort((left, right) => right.total - left.total || (left.staff.display_name || left.staff.login).localeCompare(right.staff.display_name || right.staff.login, "uk"));
      const maxTotal = totals[0]?.total || 0;
      const leaderboard = totals.map(({ staff, total }, index) => ({
        userId: staff.id,
        name: staff.display_name || staff.login,
        rank: index + 1,
        total: isAdmin(profile) || staff.id === profile.legacy_user_id ? Math.round(total * 100) / 100 : null,
        relative: maxTotal > 0 ? Math.round((total / maxTotal) * 1000) / 10 : 0,
        mine: staff.id === profile.legacy_user_id,
      }));

      const ratingMap = new Map(((ratingsResult.data ?? []) as RatingRow[]).map((rating) => [rating.user_id || "", rating.score || 0]));
      const commentsByUser = new Map<string, RatingCommentRow[]>();
      for (const comment of (commentsResult.data ?? []) as RatingCommentRow[]) {
        if (!comment.user_id) continue;
        const list = commentsByUser.get(comment.user_id) ?? [];
        if (list.length < 3) list.push({ ...comment, comment: comment.comment || comment.text || null });
        commentsByUser.set(comment.user_id, list);
      }
      const ratings = allUsers.filter(isRatingStaff).map((staff) => ({
        userId: staff.id,
        name: staff.display_name || staff.login,
        role: normalizeRole(staff.role),
        score: ratingMap.get(staff.id) ?? 0,
        comments: commentsByUser.get(staff.id) ?? [],
      })).sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "uk"));

      return json(req, {
        ok: true,
        month: range.month,
        leaderboardPeriod,
        viewUserId: viewStaff.id,
        me: {
          legacyUserId: profile.legacy_user_id,
          canViewAll: isAdmin(profile),
          canEditAll: isAdmin(profile),
          canEditRatings: isAdmin(profile),
        },
        users: selectorUsers.map((staff) => ({
          id: staff.id,
          name: staff.display_name || staff.login,
          role: normalizeRole(staff.role),
          role2: staff.role2 ? normalizeRole(staff.role2) : null,
          avatar: staff.avatar,
        })),
        entries: cashRows.filter((row) => row.user_id === viewStaff.id),
        extraWages: (extrasResult.data ?? []) as ExtraWageRow[],
        leaderboard,
        ratings,
      });
    }

    if (action === "cash_save_day" || action === "cash_delete_day") {
      if (!canUseCash(profile)) return json(req, { ok: false, error: "Cash access denied" }, 403);
      const targetUserId = typeof body.user_id === "string" ? body.user_id.trim().slice(0, 120) : "";
      const date = parseIsoDate(body.date);
      const ownRow = targetUserId === profile.legacy_user_id;
      if (!targetUserId || !date) return json(req, { ok: false, error: "Invalid cash entry" }, 400);
      if (!isAdmin(profile) && !ownRow) return json(req, { ok: false, error: "Insufficient permissions" }, 403);

      const { data: target, error: targetError } = await serviceClient.from("users").select("id,fired").eq("id", targetUserId).single();
      if (targetError || !target || target.fired === true) return json(req, { ok: false, error: "Staff member not found" }, 404);

      if (action === "cash_delete_day") {
        const [cashDelete, extraDelete] = await Promise.all([
          serviceClient.from("cash").delete().eq("user_id", targetUserId).eq("date", date),
          serviceClient.from("extra_wages").delete().eq("user_id", targetUserId).eq("date", date),
        ]);
        if (cashDelete.error) throw cashDelete.error;
        if (extraDelete.error) throw extraDelete.error;
        return json(req, { ok: true });
      }

      const cash = parseMoney(body.cash, 10_000_000);
      const tips = parseMoney(body.tips, 1_000_000);
      const extraAmount = parseMoney(body.extra_amount, 1_000_000);
      if (cash === null || tips === null || extraAmount === null) return json(req, { ok: false, error: "Invalid amount" }, 400);
      const extraNote = cleanText(body.extra_note, 300);

      const existingResult = await serviceClient.from("cash").select("first_cash").eq("user_id", targetUserId).eq("date", date).maybeSingle();
      if (existingResult.error) throw existingResult.error;
      const existingFirstCash = existingResult.data?.first_cash;

      if (cash === 0 && tips === 0) {
        const { error } = await serviceClient.from("cash").delete().eq("user_id", targetUserId).eq("date", date);
        if (error) throw error;
      } else {
        const { error } = await serviceClient.from("cash").upsert({
          user_id: targetUserId,
          date,
          cash,
          tips,
          first_cash: existingFirstCash ?? cash,
        }, { onConflict: "user_id,date" });
        if (error) throw error;
      }

      if (extraAmount === 0) {
        const { error } = await serviceClient.from("extra_wages").delete().eq("user_id", targetUserId).eq("date", date);
        if (error) throw error;
      } else {
        const { error } = await serviceClient.from("extra_wages").upsert({
          user_id: targetUserId,
          date,
          amount: extraAmount,
          description: extraNote,
          note: extraNote,
        }, { onConflict: "user_id,date" });
        if (error) throw error;
      }
      return json(req, { ok: true });
    }

    if (action === "rating_update") {
      if (!isAdmin(profile)) return json(req, { ok: false, error: "Insufficient permissions" }, 403);
      const targetUserId = typeof body.user_id === "string" ? body.user_id.trim().slice(0, 120) : "";
      const score = Number(body.score);
      const comment = cleanText(body.comment, 500);
      if (!targetUserId || !Number.isInteger(score) || score < -100 || score > 100) return json(req, { ok: false, error: "Invalid rating" }, 400);

      const [targetResult, currentResult, existingResult] = await Promise.all([
        serviceClient.from("users").select("id,fired").eq("id", targetUserId).single(),
        serviceClient.from("users").select("login,display_name").eq("id", profile.legacy_user_id).single(),
        serviceClient.from("ratings").select("score").eq("user_id", targetUserId).maybeSingle(),
      ]);
      if (targetResult.error || !targetResult.data || targetResult.data.fired === true) return json(req, { ok: false, error: "Staff member not found" }, 404);
      if (currentResult.error) throw currentResult.error;
      if (existingResult.error) throw existingResult.error;

      const previousScore = Number(existingResult.data?.score || 0);
      const delta = score - previousScore;
      const now = new Date();
      const author = currentResult.data.display_name || currentResult.data.login || "Адміністратор";
      const { error: ratingError } = await serviceClient.from("ratings").upsert({
        user_id: targetUserId,
        score,
        updated_at: now.toISOString(),
        date: now.toISOString().slice(0, 10),
        value: score,
        by: author,
      }, { onConflict: "user_id" });
      if (ratingError) throw ratingError;

      if (comment || delta !== 0) {
        const { error: commentError } = await serviceClient.from("rating_comments").insert({
          user_id: targetUserId,
          author,
          delta,
          comment,
          text: comment,
          date: now.toISOString().slice(0, 10),
        });
        if (commentError) throw commentError;
      }
      return json(req, { ok: true });
    }

    if (!canSendNotifications(profile)) return json(req, { ok: false, error: "Insufficient permissions" }, 403);
    const text = cleanText(body.text);
    if (!text) return json(req, { ok: false, error: "Message is required" }, 400);

    if (action === "send_personal") {
      await sendTelegram(String(body.chat_id ?? ""), text);
      return json(req, { ok: true });
    }

    const roles = Array.isArray(body.roles)
      ? body.roles.filter((role): role is string => typeof role === "string").slice(0, 20)
      : [];
    const { data: users, error: usersError } = await serviceClient
      .from("users")
      .select("chat_id,tg_id,role,role2,fired")
      .eq("fired", false);
    if (usersError) throw usersError;

    let sent = 0;
    let skipped = 0;
    for (const targetUser of users ?? []) {
      if (roles.length && !roles.includes(targetUser.role) && !roles.includes(targetUser.role2)) continue;
      const destination = targetUser.chat_id || targetUser.tg_id;
      if (!destination) {
        skipped += 1;
        continue;
      }
      await sendTelegram(destination, text);
      sent += 1;
    }
    return json(req, { ok: true, sent, skipped });
  } catch (error) {
    console.error("tiflis-secure-api failed", error);
    return json(req, { ok: false, error: "Operation failed" }, 502);
  }
});
