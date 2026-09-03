import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
const ALLOWED_ORIGINS = new Set((Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean));
const WINDOW_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 10 * 60 * 1000;
const ADMIN_ROLES = new Set(["admin", "sysadmin"]);
const STAFF_ROLES = new Set(["admin", "chef", "cook", "waiter", "bar", "barman", "hostess", "runner", "sommelier", "trainee", "staff"]);
const ACTIONS = new Set(["register", "reset_request", "reset_confirm", "admin_bootstrap", "admin_decide"]);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}) as any;

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? "";
  if (!origin) return {};
  if (ALLOWED_ORIGINS.size > 0 && !ALLOWED_ORIGINS.has(origin)) return {};
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

function normalizeRole(value: unknown): string | null {
  const role = cleanText(value, 30).toLowerCase();
  if (role === "bartender") return "barman";
  return STAFF_ROLES.has(role) && role !== "sysadmin" ? role : null;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return difference === 0;
}

async function rateKey(req: Request, action: string, login: string): Promise<string> {
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  return sha256(`${ip}|${action}|${login.toLocaleLowerCase("uk-UA")}`);
}

async function consumeRate(req: Request, action: string, login: string, limit: number): Promise<boolean> {
  const keyHash = await rateKey(req, action, login || "empty");
  const now = new Date();
  const { data } = await admin.from("auth_migration_attempts").select("attempts,window_started,locked_until").eq("key_hash", keyHash).maybeSingle();
  if (data?.locked_until && new Date(data.locked_until).getTime() > now.getTime()) return false;
  const expired = !data || now.getTime() - new Date(data.window_started).getTime() > WINDOW_MS;
  const attempts = expired ? 1 : Number(data.attempts || 0) + 1;
  await admin.from("auth_migration_attempts").upsert({
    key_hash: keyHash,
    attempts,
    window_started: expired ? now.toISOString() : data.window_started,
    locked_until: attempts > limit ? new Date(now.getTime() + WINDOW_MS).toISOString() : null,
    updated_at: now.toISOString(),
  });
  return attempts <= limit;
}

async function internalEmail(seed: string): Promise<string> {
  const hash = await sha256(`tiflis-registration:${seed}`);
  return `portal-${hash.slice(0, 28)}@auth.tiflis.internal`;
}

function legacyId(): string {
  return `u_${Date.now()}_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
}

function resetCode(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String((bytes[0] ?? 0) % 1_000_000).padStart(6, "0");
}

async function codeHash(legacyUserId: string, code: string): Promise<string> {
  return sha256(`${SERVICE_ROLE_KEY}|${legacyUserId}|${code}`);
}

async function sendTelegram(destination: unknown, text: string): Promise<boolean> {
  const chatId = Number(destination);
  if (!BOT_TOKEN || !Number.isSafeInteger(chatId)) return false;
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  return response.ok;
}

async function notifyAdmins(login: string): Promise<void> {
  const { data, error } = await admin.from("users").select("display_name,login,role,role2,tg_id,chat_id,fired").or("fired.is.null,fired.eq.false");
  if (error) return;
  const message = [
    "🆕 <b>Нова заявка на реєстрацію</b>",
    `Ім’я / логін: <b>${login.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</b>`,
    "Погодити або відхилити заявку можна в розділі «Управління» порталу.",
  ].join("\n");
  await Promise.allSettled((data ?? []).filter((row: any) => ADMIN_ROLES.has(String(row.role)) || ADMIN_ROLES.has(String(row.role2))).map((row: any) => sendTelegram(row.chat_id || row.tg_id, message)));
}

async function requireAdmin(req: Request): Promise<{ legacyId: string; name: string } | null> {
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return null;
  const { data: profile, error: profileError } = await userClient.from("staff_profiles").select("legacy_user_id,display_name,role,role2,active").eq("user_id", authData.user.id).single();
  if (profileError || !profile?.active || !profile.legacy_user_id) return null;
  if (!ADMIN_ROLES.has(String(profile.role)) && !ADMIN_ROLES.has(String(profile.role2))) return null;
  return { legacyId: String(profile.legacy_user_id), name: String(profile.display_name || "Адміністратор") };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) return json(req, { ok: false, error: "Server configuration error" }, 503);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { ok: false, error: "Invalid JSON" }, 400);
  }
  const action = cleanText(body.action, 40);
  if (!ACTIONS.has(action)) return json(req, { ok: false, error: "Unsupported action" }, 400);

  try {
    if (action === "register") {
      const login = cleanLogin(body.login);
      const displayName = login;
      const password = String(body.password || "");
      const confirmation = String(body.password_confirm || "");
      if (!validLogin(login) || !validPassword(password) || password !== confirmation) {
        return json(req, { ok: false, error: "Перевірте ім’я / логін і пароль. Пароль має містити щонайменше 8 символів, літеру та цифру." }, 400);
      }
      if (!await consumeRate(req, action, login, 4)) return json(req, { ok: false, error: "Забагато спроб. Повторіть пізніше." }, 429);

      const [legacyResult, pendingResult] = await Promise.all([
        admin.from("users").select("id").eq("login", login).limit(1).maybeSingle(),
        admin.from("registration_requests").select("id,status").eq("login", login).eq("status", "pending").limit(1).maybeSingle(),
      ]);
      if (legacyResult.data || pendingResult.data) return json(req, { ok: false, error: "Такий логін уже зайнятий або заявка вже очікує рішення." }, 409);

      const requestId = crypto.randomUUID();
      const email = await internalEmail(requestId);
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { source: "tiflis-self-registration", requested_login: login, requested_name: displayName },
      });
      if (authError || !authData.user) throw authError || new Error("Auth account creation failed");

      const { error: requestError } = await admin.from("registration_requests").insert({
        id: requestId,
        auth_user_id: authData.user.id,
        display_name: displayName,
        login,
        status: "pending",
      });
      if (requestError) {
        await admin.auth.admin.deleteUser(authData.user.id);
        if (requestError.code === "23505") return json(req, { ok: false, error: "Цей логін уже очікує підтвердження." }, 409);
        throw requestError;
      }

      await notifyAdmins(login);
      return json(req, { ok: true, status: "pending", message: "Заявку надіслано адміністратору. Після підтвердження можна буде увійти з цим логіном і паролем." }, 201);
    }

    if (action === "reset_request") {
      const login = cleanLogin(body.login);
      if (!validLogin(login)) return json(req, { ok: true, message: "Якщо акаунт і Telegram прив’язані, код уже надіслано." });
      if (!await consumeRate(req, action, login, 4)) return json(req, { ok: false, error: "Забагато запитів. Повторіть через 15 хвилин." }, 429);

      const { data: user } = await admin.from("users").select("id,login,display_name,tg_id,chat_id,fired").eq("login", login).limit(1).maybeSingle();
      if (!user || user.fired === true || !(user.chat_id || user.tg_id)) return json(req, { ok: true, message: "Якщо акаунт і Telegram прив’язані, код уже надіслано." });
      const { data: profile } = await admin.from("staff_profiles").select("user_id").eq("legacy_user_id", user.id).maybeSingle();
      if (!profile?.user_id) return json(req, { ok: true, message: "Якщо акаунт і Telegram прив’язані, код уже надіслано." });

      const code = resetCode();
      const hash = await codeHash(String(user.id), code);
      await admin.from("password_reset_requests").delete().eq("legacy_user_id", user.id).is("consumed_at", null);
      const { error: insertError } = await admin.from("password_reset_requests").insert({
        legacy_user_id: user.id,
        token_hash: hash,
        expires_at: new Date(Date.now() + RESET_TTL_MS).toISOString(),
      });
      if (insertError) throw insertError;

      const sent = await sendTelegram(user.chat_id || user.tg_id, [
        "🔐 <b>Відновлення доступу до порталу Тифліс</b>",
        `Ваш логін: <code>${String(user.login).replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</code>`,
        `Одноразовий код: <code>${code}</code>`,
        "Код діє 10 хвилин. Нікому його не передавайте.",
      ].join("\n"));
      if (!sent) throw new Error("Telegram delivery failed");
      return json(req, { ok: true, message: "Код і нагадування логіна надіслано у ваш Telegram." });
    }

    if (action === "reset_confirm") {
      const login = cleanLogin(body.login);
      const code = cleanText(body.code, 12);
      const password = String(body.password || "");
      const confirmation = String(body.password_confirm || "");
      if (!validLogin(login) || !/^\d{6}$/.test(code) || !validPassword(password) || password !== confirmation) {
        return json(req, { ok: false, error: "Перевірте код і новий пароль." }, 400);
      }
      if (!await consumeRate(req, action, login, 8)) return json(req, { ok: false, error: "Забагато спроб. Запросіть новий код пізніше." }, 429);

      const { data: user } = await admin.from("users").select("id,fired").eq("login", login).limit(1).maybeSingle();
      if (!user || user.fired === true) return json(req, { ok: false, error: "Код недійсний або прострочений." }, 400);
      const { data: request } = await admin.from("password_reset_requests").select("id,token_hash,expires_at,attempts").eq("legacy_user_id", user.id).is("consumed_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const suppliedHash = await codeHash(String(user.id), code);
      if (!request || Number(request.attempts || 0) >= 5 || !timingSafeEqual(String(request.token_hash), suppliedHash)) {
        if (request?.id) await admin.from("password_reset_requests").update({ attempts: Math.min(10, Number(request.attempts || 0) + 1) }).eq("id", request.id);
        return json(req, { ok: false, error: "Код недійсний або прострочений." }, 400);
      }
      const { data: profile } = await admin.from("staff_profiles").select("user_id").eq("legacy_user_id", user.id).single();
      if (!profile?.user_id) return json(req, { ok: false, error: "Акаунт ще не підключено до нового входу. Зверніться до адміністратора." }, 409);
      const { error: passwordError } = await admin.auth.admin.updateUserById(String(profile.user_id), { password });
      if (passwordError) throw passwordError;
      await Promise.all([
        admin.from("password_reset_requests").update({ consumed_at: new Date().toISOString() }).eq("id", request.id),
        admin.from("users").update({ credential_source: "auth", password: `AUTH_ONLY:${crypto.randomUUID()}` }).eq("id", user.id),
      ]);
      return json(req, { ok: true, message: "Пароль оновлено. Тепер можна увійти до порталу." });
    }

    const currentAdmin = await requireAdmin(req);
    if (!currentAdmin) return json(req, { ok: false, error: "Admin access required" }, 403);

    if (action === "admin_bootstrap") {
      const { data, error } = await admin.from("registration_requests").select("id,auth_user_id,display_name,login,status,assigned_role,legacy_user_id,requested_at,decided_at,decided_by,decision_note").order("status", { ascending: true }).order("requested_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json(req, { ok: true, requests: data ?? [] });
    }

    const requestId = cleanText(body.request_id, 80);
    const decision = cleanText(body.decision, 20);
    const role = normalizeRole(body.role);
    const note = cleanText(body.note, 500) || null;
    if (!requestId || !["approve", "reject"].includes(decision) || decision === "approve" && !role) {
      return json(req, { ok: false, error: "Invalid registration decision" }, 400);
    }
    const { data: request, error: requestError } = await admin.from("registration_requests").select("id,auth_user_id,display_name,login,status").eq("id", requestId).single();
    if (requestError || !request || request.status !== "pending") return json(req, { ok: false, error: "Registration request is not pending" }, 409);

    if (decision === "reject") {
      const { error } = await admin.from("registration_requests").update({
        status: "rejected",
        decided_at: new Date().toISOString(),
        decided_by: currentAdmin.name,
        decision_note: note,
      }).eq("id", requestId);
      if (error) throw error;
      if (request.auth_user_id) await admin.auth.admin.deleteUser(String(request.auth_user_id));
      await admin.from("audit_log").insert({ actor_id: currentAdmin.legacyId, actor_name: currentAdmin.name, action: "registration_reject", entity_type: "registration_request", entity_id: requestId, summary: `Відхилено реєстрацію ${request.login}` });
      return json(req, { ok: true, status: "rejected" });
    }

    if (!request.auth_user_id || !role) return json(req, { ok: false, error: "Auth account is missing" }, 409);
    const id = legacyId();
    const marker = `AUTH_ONLY:${crypto.randomUUID()}`;
    const { error: legacyError } = await admin.from("users").insert({
      id,
      login: request.login,
      password: marker,
      credential_source: "auth",
      role,
      role2: null,
      display_name: request.display_name,
      fired: false,
      can_notify: false,
      trainee_days: role === "trainee" ? 1 : 0,
    });
    if (legacyError) {
      if (legacyError.code === "23505") return json(req, { ok: false, error: "Такий логін уже існує" }, 409);
      throw legacyError;
    }
    const { error: profileError } = await admin.from("staff_profiles").insert({
      user_id: request.auth_user_id,
      legacy_user_id: id,
      display_name: request.display_name,
      role,
      role2: null,
      active: true,
      can_notify: false,
    });
    if (profileError) {
      await admin.from("users").delete().eq("id", id);
      throw profileError;
    }
    const { error: updateError } = await admin.from("registration_requests").update({
      status: "approved",
      assigned_role: role,
      legacy_user_id: id,
      decided_at: new Date().toISOString(),
      decided_by: currentAdmin.name,
      decision_note: note,
    }).eq("id", requestId);
    if (updateError) {
      await Promise.allSettled([
        admin.from("staff_profiles").delete().eq("user_id", request.auth_user_id),
        admin.from("users").delete().eq("id", id),
      ]);
      throw updateError;
    }
    await admin.from("audit_log").insert({ actor_id: currentAdmin.legacyId, actor_name: currentAdmin.name, action: "registration_approve", entity_type: "registration_request", entity_id: requestId, summary: `Погоджено реєстрацію ${request.login} · роль ${role}` });
    return json(req, { ok: true, status: "approved", userId: id });
  } catch (error) {
    console.error("tiflis-registration-api failed", error);
    return json(req, { ok: false, error: "Операцію не виконано. Спробуйте ще раз або зверніться до адміністратора." }, 502);
  }
});
