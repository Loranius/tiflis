import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const authClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Cache-Control": "no-store",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

async function rateKey(req: Request, login: string) {
  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown")
    .split(",")[0]
    .trim();
  return sha256(`${ip}|${login.normalize("NFKC").toLocaleLowerCase("uk-UA")}`);
}

async function blocked(keyHash: string) {
  const { data } = await admin
    .from("auth_migration_attempts")
    .select("attempts,window_started,locked_until")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!data) return false;
  const now = Date.now();
  if (data.locked_until && new Date(data.locked_until).getTime() > now) return true;
  if (now - new Date(data.window_started).getTime() > WINDOW_MS) {
    await admin.from("auth_migration_attempts").upsert({
      key_hash: keyHash,
      attempts: 0,
      window_started: new Date().toISOString(),
      locked_until: null,
      updated_at: new Date().toISOString(),
    });
  }
  return false;
}

async function registerFailure(keyHash: string) {
  const now = new Date();
  const { data } = await admin
    .from("auth_migration_attempts")
    .select("attempts,window_started")
    .eq("key_hash", keyHash)
    .maybeSingle();

  const expired = !data || Date.now() - new Date(data.window_started).getTime() > WINDOW_MS;
  const attempts = expired ? 1 : Number(data.attempts || 0) + 1;
  await admin.from("auth_migration_attempts").upsert({
    key_hash: keyHash,
    attempts,
    window_started: expired ? now.toISOString() : data.window_started,
    locked_until: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + WINDOW_MS).toISOString() : null,
    updated_at: now.toISOString(),
  });
}

async function provisionAuthUser(legacy: Record<string, unknown>, password: string) {
  const legacyId = String(legacy.id);
  const { data: profile } = await admin
    .from("staff_profiles")
    .select("user_id")
    .eq("legacy_user_id", legacyId)
    .maybeSingle();

  let userId = profile?.user_id as string | undefined;
  let email = "";

  if (userId) {
    const { data } = await admin.auth.admin.getUserById(userId);
    if (!data.user) throw new Error("Mapped Auth user is missing");
    email = data.user.email || "";
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
  } else {
    const emailHash = await sha256(`tiflis:${legacyId}`);
    email = `legacy-${emailHash.slice(0, 24)}@auth.tiflis.internal`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { legacy_user_id: legacyId, source: "tiflis-legacy-migration" },
    });
    if (error || !data.user) throw error || new Error("Auth user creation failed");
    userId = data.user.id;
  }

  const role = legacyId === "sysadmin"
    ? "sysadmin"
    : String(legacy.role || "staff");

  const { error: profileError } = await admin.from("staff_profiles").upsert({
    user_id: userId,
    legacy_user_id: legacyId,
    display_name: legacy.display_name || legacy.login || "Працівник",
    role,
    role2: legacy.role2 || null,
    active: legacy.fired !== true,
    can_notify: legacy.can_notify === true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (profileError) throw profileError;

  return { email };
}

async function safeLegacyUser(legacyId: string) {
  const { data, error } = await admin
    .from("users")
    .select("id,login,role,role2,display_name,avatar,fired,can_notify")
    .eq("id", legacyId)
    .single();
  if (error) throw error;
  if (legacyId === "sysadmin") data.role = "sysadmin";
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    return json({ ok: false, error: "Server configuration error" }, 503);
  }

  try {
    const body = await req.json() as Record<string, unknown>;
    const login = String(body.login || "").trim().normalize("NFKC");
    const password = String(body.password || "");
    const keyHash = await rateKey(req, login || "empty");

    if (!login || !password || await blocked(keyHash)) {
      await sleep(450);
      return json({ ok: false, error: "Невірний логін або пароль" }, 401);
    }

    const { data: legacy } = await admin
      .from("users")
      .select("id,login,password,role,role2,display_name,fired,can_notify")
      .eq("login", login)
      .limit(1)
      .maybeSingle();

    const valid = Boolean(
      legacy &&
      legacy.fired !== true &&
      typeof legacy.password === "string" &&
      timingSafeEqual(password, legacy.password)
    );

    if (!valid) {
      await registerFailure(keyHash);
      await sleep(450);
      return json({ ok: false, error: "Невірний логін або пароль" }, 401);
    }

    const { email } = await provisionAuthUser(legacy, password);
    const { data: signIn, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
    if (signInError || !signIn.session) throw signInError || new Error("Session creation failed");

    await admin.from("auth_migration_attempts").delete().eq("key_hash", keyHash);

    return json({
      ok: true,
      session: {
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
        expires_at: signIn.session.expires_at,
        expires_in: signIn.session.expires_in,
        token_type: signIn.session.token_type,
      },
      user: await safeLegacyUser(String(legacy.id)),
    });
  } catch (error) {
    console.error("tiflis-auth-migrate failed", error);
    return json({ ok: false, error: "Не вдалося створити захищену сесію" }, 500);
  }
});
