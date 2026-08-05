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
  return Number.isFinite(parsed) ? parsed : 0;
}

function leaderboardRange(month: unknown, period: unknown): { start: string; end: string } | null {
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [yearText = "", monthText = ""] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  if (period === "year") return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
  if (period === "first") return { start: `${month}-01`, end: `${month}-15` };
  if (period === "second") return { start: `${month}-15`, end: nextMonth };
  return { start: `${month}-01`, end: nextMonth };
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

  const range = leaderboardRange(body.month, body.leaderboard_period);
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
      .lt("date", range.end);
    if (cashResult.error) throw cashResult.error;

    const positiveCashUsers = new Set<string>();
    for (const row of (cashResult.data ?? []) as CashRow[]) {
      if (!row.user_id) continue;
      if (numberOf(row.cash) > 0) positiveCashUsers.add(row.user_id);
    }

    const sourceRows = Array.isArray(payload.leaderboard) ? payload.leaderboard : [];
    const leaderboard = sourceRows
      .map((row) => row && typeof row === "object" ? row as Record<string, unknown> : {})
      .filter((item) => typeof item.userId === "string" && positiveCashUsers.has(item.userId))
      .sort((left, right) => Number(left.rank || 0) - Number(right.rank || 0))
      .map((item, index) => ({ rank: index + 1, mine: item.mine === true }));

    return json(req, {
      ...payload,
      leaderboard,
      leaderboardPrivacy: "anonymous-positive-cash-ranks-only",
    });
  } catch {
    return json(req, { ok: false, error: "Cash service unavailable" }, 502);
  }
});
