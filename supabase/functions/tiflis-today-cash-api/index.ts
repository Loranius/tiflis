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

const ACTIONS = new Set(["today_cash_get", "today_cash_save"]);
const CASH_ROLES = new Set(["waiter", "bar", "barman", "bartender"]);

type StaffProfile = {
  legacy_user_id: string | null;
  role: string;
  role2: string | null;
  active: boolean;
};

type CashRow = {
  id: number;
  user_id: string | null;
  date: string;
  cash: number | string | null;
  tips: number | string | null;
  first_cash: number | string | null;
};

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? "";
  if (!origin || (ALLOWED_ORIGINS.size > 0 && !ALLOWED_ORIGINS.has(origin))) return {};
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

function normalizeRole(value: string | null | undefined): string {
  if (value === "barman" || value === "bartender") return "bar";
  return value || "staff";
}

function profileRoles(profile: StaffProfile): string[] {
  return [normalizeRole(profile.role), normalizeRole(profile.role2)]
    .filter((role, index, roles) => Boolean(role) && roles.indexOf(role) === index);
}

function isAdmin(profile: StaffProfile): boolean {
  return profile.active && profileRoles(profile).some((role) => role === "admin" || role === "sysadmin");
}

function canUseCash(profile: StaffProfile): boolean {
  return profile.active && (isAdmin(profile) || profileRoles(profile).some((role) => CASH_ROLES.has(role)));
}

function parseMoney(value: unknown, max: number): number | null {
  const normalized = typeof value === "string" ? value.replace(",", ".").trim() : value;
  const parsed = normalized === "" || normalized === null || normalized === undefined ? 0 : Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return null;
  return Math.round(parsed * 100) / 100;
}

function numberOf(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function kyivDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function publicEntry(row: CashRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    date: row.date,
    cash: numberOf(row.cash),
    tips: numberOf(row.tips),
    firstCash: numberOf(row.first_cash),
  };
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

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json(req, { ok: false, error: "Invalid session" }, 401);

  const { data: rawProfile, error: profileError } = await userClient
    .from("staff_profiles")
    .select("legacy_user_id,role,role2,active")
    .eq("user_id", authData.user.id)
    .single();
  const profile = rawProfile as StaffProfile | null;
  if (profileError || !profile?.active || !profile.legacy_user_id) {
    return json(req, { ok: false, error: "Active staff profile required" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { ok: false, error: "Invalid JSON" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.has(action)) return json(req, { ok: false, error: "Unsupported action" }, 400);

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const date = kyivDateKey();
  const allowed = canUseCash(profile);

  try {
    if (action === "today_cash_get") {
      if (!allowed) return json(req, { ok: true, date, canUseCash: false, entry: null });

      const { data: staff, error: staffError } = await service
        .from("users")
        .select("id,fired")
        .eq("id", profile.legacy_user_id)
        .single();
      if (staffError || !staff || staff.fired === true) {
        return json(req, { ok: false, error: "Staff member not found" }, 404);
      }

      const { data, error } = await service
        .from("cash")
        .select("id,user_id,date,cash,tips,first_cash")
        .eq("user_id", profile.legacy_user_id)
        .eq("date", date)
        .maybeSingle();
      if (error) throw error;
      return json(req, {
        ok: true,
        date,
        canUseCash: true,
        entry: publicEntry((data as CashRow | null) ?? null),
      });
    }

    if (!allowed) return json(req, { ok: false, error: "Cash access denied" }, 403);
    if (body.date !== date) {
      return json(req, { ok: false, error: "Швидкий запис доступний лише за поточний київський день." }, 400);
    }

    const cash = parseMoney(body.cash, 10_000_000);
    const tips = parseMoney(body.tips, 1_000_000);
    if (cash === null || tips === null) {
      return json(req, { ok: false, error: "Некоректна сума." }, 400);
    }

    const { data: staff, error: staffError } = await service
      .from("users")
      .select("id,fired")
      .eq("id", profile.legacy_user_id)
      .single();
    if (staffError || !staff || staff.fired === true) {
      return json(req, { ok: false, error: "Staff member not found" }, 404);
    }

    const existingResult = await service
      .from("cash")
      .select("first_cash")
      .eq("user_id", profile.legacy_user_id)
      .eq("date", date)
      .maybeSingle();
    if (existingResult.error) throw existingResult.error;

    if (cash === 0 && tips === 0) {
      const { error } = await service
        .from("cash")
        .delete()
        .eq("user_id", profile.legacy_user_id)
        .eq("date", date);
      if (error) throw error;
      return json(req, { ok: true, date, canUseCash: true, entry: null });
    }

    const { data, error } = await service
      .from("cash")
      .upsert({
        user_id: profile.legacy_user_id,
        date,
        cash,
        tips,
        first_cash: existingResult.data?.first_cash ?? cash,
      }, { onConflict: "user_id,date" })
      .select("id,user_id,date,cash,tips,first_cash")
      .single();
    if (error) throw error;

    return json(req, {
      ok: true,
      date,
      canUseCash: true,
      entry: publicEntry(data as CashRow),
    });
  } catch (error) {
    console.error("today cash api failed", error);
    return json(req, { ok: false, error: "Не вдалося оновити касу." }, 500);
  }
});
