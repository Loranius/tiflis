import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
const WINDOW_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 10 * 60 * 1000;
const ACTIONS = new Set(["reset_request", "reset_confirm"]);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}) as any;

const CORS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Max-Age": "86400",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanLogin(value: unknown): string {
  return cleanText(value, 40).normalize("NFKC").replace(/\s+/g, " ");
}

function validLogin(value: string): boolean {
  return /^(?=.{2,40}$)[\p{L}\p{N}._-]+(?: [\p{L}\p{N}._-]+)*$/u.test(value);
}

function validPassword(value: string): boolean {
  return value.length >= 8 && value.length <= 128 && /\p{L}/u.test(value) && /\d/u.test(value);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

async function rateKey(req: Request, action: string, login: string): Promise<string> {
  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown")
    .split(",")[0]
    .trim();
  return sha256(`${ip}|password-reset|${action}|${login.toLocaleLowerCase("uk-UA")}`);
}

async function consumeRate(
  req: Request,
  action: string,
  login: string,
  limit: number,
): Promise<{ allowed: boolean; keyHash: string }> {
  const keyHash = await rateKey(req, action, login || "empty");
  const now = new Date();
  const { data, error } = await admin
    .from("auth_migration_attempts")
    .select("attempts,window_started,locked_until")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (error) throw error;
  if (data?.locked_until && new Date(data.locked_until).getTime() > now.getTime()) {
    return { allowed: false, keyHash };
  }

  const expired = !data || now.getTime() - new Date(data.window_started).getTime() > WINDOW_MS;
  const attempts = expired ? 1 : Number(data.attempts || 0) + 1;
  const { error: upsertError } = await admin.from("auth_migration_attempts").upsert({
    key_hash: keyHash,
    attempts,
    window_started: expired ? now.toISOString() : data.window_started,
    locked_until: attempts > limit ? new Date(now.getTime() + WINDOW_MS).toISOString() : null,
    updated_at: now.toISOString(),
  });
  if (upsertError) throw upsertError;
  return { allowed: attempts <= limit, keyHash };
}

function resetCode(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String((bytes[0] ?? 0) % 1_000_000).padStart(6, "0");
}

async function codeHash(legacyUserId: string, code: string): Promise<string> {
  return sha256(`${SERVICE_ROLE_KEY}|${legacyUserId}|${code}`);
}

async function sendTelegram(
  destination: unknown,
  text: string,
): Promise<{ ok: boolean; reason?: string }> {
  const rawChatId = String(destination ?? "").trim();
  const chatId = Number(rawChatId);
  if (!BOT_TOKEN) {
    console.error("Password reset Telegram delivery unavailable: BOT_TOKEN is missing");
    return { ok: false, reason: "bot_not_configured" };
  }
  if (!/^-?\d+$/.test(rawChatId) || !Number.isSafeInteger(chatId)) {
    console.error("Password reset Telegram delivery unavailable: invalid chat id");
    return { ok: false, reason: "invalid_chat_id" };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const payload = await response.json().catch(() => null) as {
      ok?: boolean;
      error_code?: number;
      description?: string;
    } | null;
    if (!response.ok || payload?.ok === false) {
      console.error("Password reset Telegram sendMessage failed", {
        status: response.status,
        errorCode: payload?.error_code,
        description: payload?.description,
        chatIdSuffix: rawChatId.slice(-4),
      });
      return { ok: false, reason: payload?.description || `http_${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    console.error("Password reset Telegram network error", error);
    return { ok: false, reason: "network_error" };
  }
}

async function legacyAuthEmail(legacyUserId: string): Promise<string> {
  const hash = await sha256(`tiflis:${legacyUserId}`);
  return `legacy-${hash.slice(0, 24)}@auth.tiflis.internal`;
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = (data.users ?? []).find((user: any) => user.email === email);
    if (found?.id) return String(found.id);
    if ((data.users ?? []).length < 200) return null;
  }
  return null;
}

async function ensureAuthAccount(legacy: Record<string, any>, password: string): Promise<string> {
  const legacyUserId = String(legacy.id);
  const { data: currentProfile, error: profileReadError } = await admin
    .from("staff_profiles")
    .select("user_id")
    .eq("legacy_user_id", legacyUserId)
    .maybeSingle();
  if (profileReadError) throw profileReadError;

  if (currentProfile?.user_id) {
    const { error } = await admin.auth.admin.updateUserById(String(currentProfile.user_id), { password });
    if (error) throw error;
    return String(currentProfile.user_id);
  }

  const email = await legacyAuthEmail(legacyUserId);
  let authUserId = await findAuthUserIdByEmail(email);
  let createdNow = false;

  if (authUserId) {
    const { error } = await admin.auth.admin.updateUserById(authUserId, {
      password,
      user_metadata: { legacy_user_id: legacyUserId, source: "tiflis-telegram-password-reset" },
    });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { legacy_user_id: legacyUserId, source: "tiflis-telegram-password-reset" },
    });
    if (error || !data.user) throw error || new Error("Auth user creation failed");
    authUserId = String(data.user.id);
    createdNow = true;
  }

  const role = legacyUserId === "sysadmin" ? "sysadmin" : String(legacy.role || "staff");
  const { error: profileInsertError } = await admin.from("staff_profiles").insert({
    user_id: authUserId,
    legacy_user_id: legacyUserId,
    display_name: legacy.display_name || legacy.login || "Працівник",
    role,
    role2: legacy.role2 || null,
    active: legacy.fired !== true,
    can_notify: legacy.can_notify === true,
  });

  if (profileInsertError) {
    const { data: racedProfile } = await admin
      .from("staff_profiles")
      .select("user_id")
      .eq("legacy_user_id", legacyUserId)
      .maybeSingle();
    if (racedProfile?.user_id) {
      if (createdNow && String(racedProfile.user_id) !== authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
      const racedUserId = String(racedProfile.user_id);
      const { error: updateError } = await admin.auth.admin.updateUserById(racedUserId, { password });
      if (updateError) throw updateError;
      return racedUserId;
    }
    if (createdNow) await admin.auth.admin.deleteUser(authUserId);
    throw profileInsertError;
  }

  return authUserId;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "Server configuration error" }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const action = cleanText(body.action, 40);
  if (!ACTIONS.has(action)) return json({ ok: false, error: "Unsupported action" }, 400);

  try {
    if (action === "reset_request") {
      const login = cleanLogin(body.login);
      if (!validLogin(login)) {
        return json({ ok: true, message: "Якщо акаунт і Telegram прив’язані, код уже надіслано." });
      }

      const rate = await consumeRate(req, action, login, 4);
      if (!rate.allowed) {
        return json({ ok: false, error: "Забагато запитів. Повторіть через 15 хвилин." }, 429);
      }

      const { data: user, error: userError } = await admin
        .from("users")
        .select("id,login,display_name,tg_id,chat_id,fired")
        .eq("login", login)
        .limit(1)
        .maybeSingle();
      if (userError) throw userError;
      if (!user || user.fired === true || !(user.chat_id || user.tg_id)) {
        return json({ ok: true, message: "Якщо акаунт і Telegram прив’язані, код уже надіслано." });
      }

      const code = resetCode();
      const hash = await codeHash(String(user.id), code);
      const { error: cleanupError } = await admin
        .from("password_reset_requests")
        .delete()
        .eq("legacy_user_id", user.id)
        .is("consumed_at", null);
      if (cleanupError) throw cleanupError;

      const { data: request, error: insertError } = await admin
        .from("password_reset_requests")
        .insert({
          legacy_user_id: user.id,
          token_hash: hash,
          expires_at: new Date(Date.now() + RESET_TTL_MS).toISOString(),
        })
        .select("id")
        .single();
      if (insertError || !request?.id) throw insertError || new Error("Reset request creation failed");

      const delivery = await sendTelegram(user.chat_id || user.tg_id, [
        "🔐 <b>Відновлення доступу до порталу Тифліс</b>",
        `Ваш логін: <code>${escapeHtml(user.login)}</code>`,
        `Одноразовий код: <code>${code}</code>`,
        "Код діє 10 хвилин. Нікому його не передавайте.",
      ].join("\n"));

      if (!delivery.ok) {
        await admin.from("password_reset_requests").delete().eq("id", request.id);
        return json({
          ok: false,
          error: "Не вдалося доставити код у Telegram. Відкрийте чат із ботом, натисніть /start і повторіть спробу.",
        }, 502);
      }

      return json({ ok: true, message: "Код і нагадування логіна надіслано у ваш Telegram." });
    }

    const login = cleanLogin(body.login);
    const code = cleanText(body.code, 12);
    const password = String(body.password || "");
    const confirmation = String(body.password_confirm || "");
    if (!validLogin(login) || !/^\d{6}$/.test(code) || !validPassword(password) || password !== confirmation) {
      return json({ ok: false, error: "Перевірте код і новий пароль. Пароль має містити щонайменше 8 символів, літеру та цифру." }, 400);
    }

    const rate = await consumeRate(req, action, login, 8);
    if (!rate.allowed) {
      return json({ ok: false, error: "Забагато спроб. Запросіть новий код пізніше." }, 429);
    }

    const { data: user, error: userError } = await admin
      .from("users")
      .select("id,login,display_name,role,role2,fired,can_notify")
      .eq("login", login)
      .limit(1)
      .maybeSingle();
    if (userError) throw userError;
    if (!user || user.fired === true) {
      return json({ ok: false, error: "Код недійсний або прострочений." }, 400);
    }

    const { data: request, error: requestError } = await admin
      .from("password_reset_requests")
      .select("id,token_hash,attempts")
      .eq("legacy_user_id", user.id)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (requestError) throw requestError;

    const suppliedHash = await codeHash(String(user.id), code);
    if (!request || Number(request.attempts || 0) >= 5 || !timingSafeEqual(String(request.token_hash), suppliedHash)) {
      if (request?.id) {
        await admin
          .from("password_reset_requests")
          .update({ attempts: Math.min(10, Number(request.attempts || 0) + 1) })
          .eq("id", request.id);
      }
      return json({ ok: false, error: "Код недійсний або прострочений." }, 400);
    }

    await ensureAuthAccount(user, password);

    const now = new Date().toISOString();
    const marker = `AUTH_ONLY:${crypto.randomUUID()}`;
    const [consumeResult, legacyResult, rateResult] = await Promise.all([
      admin.from("password_reset_requests").update({ consumed_at: now }).eq("id", request.id),
      admin.from("users").update({ credential_source: "auth", password: marker }).eq("id", user.id),
      admin.from("auth_migration_attempts").delete().eq("key_hash", rate.keyHash),
    ]);
    if (consumeResult.error) throw consumeResult.error;
    if (legacyResult.error) throw legacyResult.error;
    if (rateResult.error) throw rateResult.error;

    return json({ ok: true, message: "Пароль оновлено. Тепер можна увійти до порталу." });
  } catch (error) {
    console.error("tiflis-password-reset-api failed", error);
    return json({ ok: false, error: "Операцію не виконано. Спробуйте ще раз або зверніться до адміністратора." }, 502);
  }
});
