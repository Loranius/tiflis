import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { ok: false, error: "Method not allowed" }, 405);
  }
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

    if (!upstream.ok || payload.ok !== true) {
      return json(req, payload, upstream.status);
    }

    const leaderboard = Array.isArray(payload.leaderboard)
      ? payload.leaderboard.map((row) => {
        const item = row && typeof row === "object" ? row as Record<string, unknown> : {};
        return {
          rank: Number.isFinite(Number(item.rank)) ? Number(item.rank) : 0,
          mine: item.mine === true,
        };
      }).filter((row) => row.rank > 0)
      : [];

    return json(req, {
      ...payload,
      leaderboard,
      leaderboardPrivacy: "anonymous-ranks-only",
    });
  } catch {
    return json(req, { ok: false, error: "Cash service unavailable" }, 502);
  }
});
