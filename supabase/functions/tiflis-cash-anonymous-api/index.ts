import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

type CashRow = {
  user_id: string | null;
  date: string;
  cash: number | string | null;
};

type MonthRange = {
  month: string;
  start: string;
  end: string;
  year: number;
  monthNumber: number;
  daysInMonth: number;
};

type TimelinePoint = {
  rank: number;
  progress: number;
};

type SourceLeaderboardRow = Record<string, unknown> & {
  userId?: unknown;
  name?: unknown;
  rank?: unknown;
  mine?: unknown;
  avatar?: unknown;
  role?: unknown;
  role2?: unknown;
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

function numberOf(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function parseMonth(value: unknown): MonthRange | null {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const [yearText = "", monthText = ""] = value.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    month: value,
    start: `${value}-01`,
    end: new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10),
    year,
    monthNumber,
    daysInMonth,
  };
}

function dateForDay(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`;
}

function kyivToday(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function publicName(item: SourceLeaderboardRow, fallbackRank: number): string {
  return typeof item.name === "string" && item.name.trim()
    ? item.name.trim()
    : `Працівник #${fallbackRank}`;
}

function visibleLastDay(range: MonthRange, today: string): number {
  const currentMonth = today.slice(0, 7);
  if (range.month < currentMonth) return range.daysInMonth;
  if (range.month > currentMonth) return 0;
  const todayDay = Number(today.slice(-2));
  return Math.max(0, Math.min(range.daysInMonth, todayDay));
}

function buildTimeline(
  range: MonthRange,
  sourceRows: SourceLeaderboardRow[],
  cashRows: CashRow[],
  exactProgress: boolean,
): Map<string, Record<string, TimelinePoint>> {
  const today = kyivToday();
  const lastVisibleDay = visibleLastDay(range, today);
  const timeline = new Map<string, Record<string, TimelinePoint>>();
  const ids = sourceRows
    .map((row) => typeof row.userId === "string" ? row.userId : "")
    .filter(Boolean);

  for (const id of ids) timeline.set(id, {});
  if (!ids.length || lastVisibleDay <= 0) return timeline;

  const dailyCash = new Map<string, Map<number, number>>();
  for (const id of ids) dailyCash.set(id, new Map());
  for (const row of cashRows) {
    if (!row.user_id || !dailyCash.has(row.user_id) || !row.date.startsWith(`${range.month}-`)) continue;
    const day = Number(row.date.slice(-2));
    if (!Number.isInteger(day) || day < 1 || day > range.daysInMonth) continue;
    const perDay = dailyCash.get(row.user_id);
    if (!perDay) continue;
    perDay.set(day, (perDay.get(day) ?? 0) + numberOf(row.cash));
  }

  const stableOrder = new Map<string, number>();
  sourceRows.forEach((row, index) => {
    if (typeof row.userId === "string") stableOrder.set(row.userId, index);
  });

  const cycleTarget = (cycleStart: number, cycleEnd: number): number => {
    const availableEnd = Math.min(cycleEnd, lastVisibleDay);
    if (availableEnd < cycleStart) return 0;

    let leaderToDate = 0;
    for (const id of ids) {
      const perDay = dailyCash.get(id);
      let total = 0;
      for (let day = cycleStart; day <= availableEnd; day += 1) total += perDay?.get(day) ?? 0;
      leaderToDate = Math.max(leaderToDate, total);
    }
    if (leaderToDate <= 0) return 0;

    const cycleLength = cycleEnd - cycleStart + 1;
    const elapsed = availableEnd - cycleStart + 1;
    const completed = lastVisibleDay >= cycleEnd;
    return completed ? leaderToDate : leaderToDate * (cycleLength / Math.max(1, elapsed));
  };

  const firstTarget = cycleTarget(1, Math.min(14, range.daysInMonth));
  const secondTarget = range.daysInMonth >= 15 ? cycleTarget(15, range.daysInMonth) : 0;
  const running = new Map<string, number>(ids.map((id) => [id, 0]));

  for (let day = 1; day <= lastVisibleDay; day += 1) {
    const cycleStart = day <= 14 ? 1 : 15;
    if (day === cycleStart) {
      for (const id of ids) running.set(id, 0);
    }

    for (const id of ids) {
      running.set(id, (running.get(id) ?? 0) + (dailyCash.get(id)?.get(day) ?? 0));
    }

    const ranked = ids
      .map((id) => ({ id, total: running.get(id) ?? 0 }))
      .sort((left, right) => {
        if (right.total !== left.total) return right.total - left.total;
        return (stableOrder.get(left.id) ?? 9999) - (stableOrder.get(right.id) ?? 9999);
      });
    const target = day <= 14 ? firstTarget : secondTarget;
    const date = dateForDay(range.month, day);

    ranked.forEach((entry, index) => {
      const rawProgress = target > 0 ? Math.min(100, (entry.total / target) * 100) : 0;
      const progress = exactProgress
        ? Math.round(rawProgress * 10) / 10
        : Math.max(0, Math.min(100, Math.round(rawProgress / 5) * 5));
      const userTimeline = timeline.get(entry.id);
      if (userTimeline) userTimeline[date] = { rank: index + 1, progress };
    });
  }

  return timeline;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(req, { ok: false, error: "Server configuration error" }, 503);
  }

  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return json(req, { ok: false, error: "Authentication required" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { ok: false, error: "Invalid JSON" }, 400);
  }

  if (body.action !== "cash_bootstrap") {
    return json(req, { ok: false, error: "Unsupported action" }, 400);
  }

  const range = parseMonth(body.month);
  if (!range) return json(req, { ok: false, error: "Invalid month" }, 400);

  try {
    const upstream = await fetch(`${SUPABASE_URL}/functions/v1/tiflis-secure-api`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    let payload: Record<string, unknown>;
    try {
      payload = await upstream.json() as Record<string, unknown>;
    } catch {
      return json(req, { ok: false, error: "Invalid upstream response" }, 502);
    }

    if (!upstream.ok || payload.ok !== true) return json(req, payload, upstream.status);

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const cashResult = await serviceClient
      .from("cash")
      .select("user_id,date,cash")
      .gte("date", range.start)
      .lt("date", range.end)
      .order("date", { ascending: true });
    if (cashResult.error) throw cashResult.error;

    const sourceRows = (Array.isArray(payload.leaderboard) ? payload.leaderboard : [])
      .map((row) => row && typeof row === "object" ? row as SourceLeaderboardRow : {})
      .filter((row) => typeof row.userId === "string" && Boolean(row.userId));
    const me = payload.me && typeof payload.me === "object"
      ? payload.me as Record<string, unknown>
      : {};
    const exactProgress = me.canViewAll === true;
    const timeline = buildTimeline(range, sourceRows, (cashResult.data ?? []) as CashRow[], exactProgress);

    const leaderboard = sourceRows.map((item, index) => {
      const userId = String(item.userId);
      const fallbackRank = index + 1;
      const name = publicName(item, fallbackRank);
      const avatar = typeof item.avatar === "string" && item.avatar.trim() ? item.avatar.trim() : null;
      const role = typeof item.role === "string" && item.role.trim() ? item.role.trim() : "staff";
      const role2 = typeof item.role2 === "string" && item.role2.trim() ? item.role2.trim() : null;
      const userTimeline = timeline.get(userId) ?? {};
      const dates = Object.keys(userTimeline).sort();
      const latestPoint = dates.length ? userTimeline[dates[dates.length - 1] ?? ""] : undefined;

      return {
        ...item,
        userId,
        name,
        rank: latestPoint?.rank ?? Number(item.rank || fallbackRank),
        mine: item.mine === true,
        avatar,
        role,
        role2,
        timeline: userTimeline,
      };
    }).sort((left, right) => Number(left.rank || 0) - Number(right.rank || 0));

    return json(req, {
      ...payload,
      leaderboard,
      leaderboardPrivacy: "named-staff-with-hidden-cash-timeline",
      leaderboardTimeline: {
        month: range.month,
        daysInMonth: range.daysInMonth,
        resetDays: [1, 15],
        summitDays: [Math.min(14, range.daysInMonth), range.daysInMonth],
        values: "rank-and-normalized-progress-only",
      },
    });
  } catch (error) {
    console.error("tiflis-cash-anonymous-api failed", error);
    return json(req, { ok: false, error: "Cash service unavailable" }, 502);
  }
});
