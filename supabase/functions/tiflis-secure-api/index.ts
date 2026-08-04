import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

const MAX_TEXT_LENGTH = 3500;
const ALLOWED_ACTIONS = new Set(["send_personal", "broadcast"]);

type StaffProfile = {
  role: string;
  role2: string | null;
  active: boolean;
  can_notify: boolean;
};

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? "";
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
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

function isPrivileged(profile: StaffProfile): boolean {
  return profile.active && (
    profile.can_notify ||
    profile.role === "admin" ||
    profile.role === "sysadmin" ||
    profile.role2 === "admin" ||
    profile.role2 === "sysadmin"
  );
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT_LENGTH) : "";
}

async function sendTelegram(chatId: number | string, text: string): Promise<void> {
  const numericChatId = Number(chatId);
  if (!Number.isSafeInteger(numericChatId) || !text) throw new Error("Invalid Telegram request");

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: numericChatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) throw new Error(`Telegram rejected request: ${response.status}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Method not allowed" }, 405);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !BOT_TOKEN) {
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

  const { data: profile, error: profileError } = await userClient
    .from("staff_profiles")
    .select("role,role2,active,can_notify")
    .eq("user_id", authData.user.id)
    .single<StaffProfile>();

  if (profileError || !profile || !isPrivileged(profile)) {
    return json(req, { ok: false, error: "Insufficient permissions" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { ok: false, error: "Invalid JSON" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!ALLOWED_ACTIONS.has(action)) return json(req, { ok: false, error: "Unsupported action" }, 400);

  const text = cleanText(body.text);
  if (!text) return json(req, { ok: false, error: "Message is required" }, 400);

  try {
    if (action === "send_personal") {
      await sendTelegram(String(body.chat_id ?? ""), text);
      return json(req, { ok: true });
    }

    const roles = Array.isArray(body.roles)
      ? body.roles.filter((role): role is string => typeof role === "string").slice(0, 20)
      : [];

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: users, error: usersError } = await serviceClient
      .from("users")
      .select("chat_id,tg_id,role,role2,fired")
      .eq("fired", false);
    if (usersError) throw usersError;

    let sent = 0;
    let skipped = 0;
    for (const user of users ?? []) {
      if (roles.length && !roles.includes(user.role) && !roles.includes(user.role2)) continue;
      const destination = user.chat_id || user.tg_id;
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
