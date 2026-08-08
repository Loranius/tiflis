import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

type MonthRange = {
  month: string;
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
  timeline?: unknown;
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

function parseMonth(value: unknown): MonthRange | null {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const [yearText = "", monthText = ""] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  return {
    month: value,
    daysInMonth: new Date(Date.UTC(year, month, 0)).getUTCDate(),
  };
}

function publicName(item: SourceLeaderboardRow, fallbackRank: number): string {
  return typeof item.name === "string" && item.name.trim()
    ? item.name.trim()
    : `Працівник #${fallbackRank}`;
}

function normalizeTimeline(value: unknown): Record<string, TimelinePoint> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const timeline: Record<string, TimelinePoint> = {};
  for (const [date, rawPoint] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !rawPoint || typeof rawPoint !== "object" || Array.isArray(rawPoint)) continue;
    const point = rawPoint as Record<string, unknown>;
    const rank = Number(point.rank);
    const progress = Number(point.progress);
    if (!Number.isInteger(rank) || rank < 1 || !Number.isFinite(progress)) continue;
    timeline[date] = {
      rank,
      progress: Math.max(0, Math.min(100, progress)),
    };
  }
  return timeline;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
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

    const sourceRows = (Array.isArray(payload.leaderboard) ? payload.leaderboard : [])
      .map((row) => row && typeof row === "object" ? row as SourceLeaderboardRow : {})
      .filter((row) => typeof row.userId === "string" && Boolean(row.userId));

    const leaderboard = sourceRows.map((item, index) => {
      const userId = String(item.userId);
      const fallbackRank = index + 1;
      const sourceRank = Number(item.rank);
      const rank = Number.isInteger(sourceRank) && sourceRank > 0 ? sourceRank : fallbackRank;
      const name = publicName(item, rank);
      const avatar = typeof item.avatar === "string" && item.avatar.trim() ? item.avatar.trim() : null;
      const role = typeof item.role === "string" && item.role.trim() ? item.role.trim() : "staff";
      const role2 = typeof item.role2 === "string" && item.role2.trim() ? item.role2.trim() : null;

      return {
        ...item,
        userId,
        name,
        rank,
        mine: item.mine === true,
        avatar,
        role,
        role2,
        timeline: normalizeTimeline(item.timeline),
      };
    }).sort((left, right) => Number(left.rank || 0) - Number(right.rank || 0));

    const leaderboardPeriod = typeof payload.leaderboardPeriod === "string"
      ? payload.leaderboardPeriod
      : typeof body.leaderboard_period === "string"
        ? body.leaderboard_period
        : "first";

    return json(req, {
      ...payload,
      leaderboard,
      leaderboardPrivacy: "named-staff-with-hidden-cash-timeline",
      leaderboardTimeline: {
        month: range.month,
        daysInMonth: range.daysInMonth,
        period: leaderboardPeriod,
        source: "secure-period-ranking",
        values: "rank-and-normalized-progress-only",
      },
    });
  } catch (error) {
    console.error("tiflis-cash-anonymous-api failed", error);
    return json(req, { ok: false, error: "Cash service unavailable" }, 502);
  }
});
