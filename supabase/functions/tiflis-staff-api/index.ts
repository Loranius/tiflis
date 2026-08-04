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

const ACTIONS = new Set([
  "staff_bootstrap",
  "staff_save",
  "staff_create",
  "staff_set_active",
  "staff_reset_password",
]);
const ADMIN_ROLES = new Set(["admin", "sysadmin"]);
const ROLE_KEYS = new Set([
  "admin", "chef", "cook", "waiter", "bar", "barman", "hostess",
  "runner", "sommelier", "trainee", "staff",
]);
const ROLE_LABELS: Record<string, string> = {
  sysadmin: "Сисадмін",
  admin: "Адміністрація",
  chef: "Шеф-кухар",
  cook: "Кухня",
  waiter: "Офіціант",
  bar: "Бар",
  barman: "Бар",
  hostess: "Хостес",
  runner: "Ранер",
  sommelier: "Сомельє",
  trainee: "Стажер",
  staff: "Працівник",
};

type StaffProfile = {
  user_id: string;
  legacy_user_id: string | null;
  role: string;
  role2: string | null;
  active: boolean;
  can_notify: boolean;
};

type LegacyStaff = {
  id: string;
  login: string;
  role: string;
  role2: string | null;
  display_name: string | null;
  nick: string | null;
  avatar: string | null;
  tg_id: number | null;
  tg_username: string | null;
  ig: string | null;
  fired: boolean | null;
  created_at: string | null;
  display_role: string | null;
  birthday: string | null;
  trainee_days: number | null;
  zodiac: string | null;
  can_notify: boolean | null;
  credo: string | null;
  credential_source: string | null;
  updated_at: string | null;
};

type StaffSaveInput = {
  targetId: string;
  login: string;
  displayName: string;
  nick: string | null;
  avatar: string | null;
  tgUsername: string | null;
  instagram: string | null;
  birthday: string | null;
  credo: string | null;
  role: string;
  role2: string | null;
  displayRole: string | null;
  traineeDays: number;
  canNotify: boolean;
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
  return value === "bartender" ? "barman" : value || "staff";
}

function profileRoles(profile: StaffProfile): string[] {
  return [normalizeRole(profile.role), normalizeRole(profile.role2)].filter(
    (role, index, all) => Boolean(role) && all.indexOf(role) === index,
  );
}

function isAdmin(profile: StaffProfile): boolean {
  return profile.active && profileRoles(profile).some((role) => ADMIN_ROLES.has(role));
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanLogin(value: unknown): string {
  return cleanText(value, 40).normalize("NFKC");
}

function validLogin(value: string): boolean {
  return /^[\p{L}\p{N}._-]{2,40}$/u.test(value);
}

function parseRole(value: unknown, allowEmpty = false): string | null {
  const role = normalizeRole(cleanText(value, 30));
  if (allowEmpty && (!value || role === "staff" && cleanText(value, 30) === "")) return null;
  return ROLE_KEYS.has(role) ? role : null;
}

function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function parseAvatar(value: unknown): string | null | "invalid" {
  const avatar = cleanText(value, 1000);
  if (!avatar) return null;
  try {
    const url = new URL(avatar);
    return url.protocol === "https:" ? url.toString() : "invalid";
  } catch {
    return "invalid";
  }
}

function cleanHandle(value: unknown, maxLength = 64): string | null {
  const handle = cleanText(value, maxLength).replace(/^@+/, "");
  return handle || null;
}

function parseTraineeDays(value: unknown): number | null {
  const parsed = Number(value ?? 0);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 3650 ? parsed : null;
}

function parseStaffSave(body: Record<string, unknown>, current: LegacyStaff, admin: boolean): StaffSaveInput | null {
  const targetId = cleanText(body.user_id, 120);
  const login = admin ? cleanLogin(body.login) : current.login;
  const displayName = cleanText(body.display_name, 120);
  const avatar = parseAvatar(body.avatar);
  const birthday = parseDate(body.birthday);
  const traineeDays = admin ? parseTraineeDays(body.trainee_days) : Number(current.trainee_days || 0);
  const role = admin ? parseRole(body.role) : normalizeRole(current.role);
  const role2 = admin ? parseRole(body.role2, true) : current.role2;

  if (!targetId || !displayName || !validLogin(login) || avatar === "invalid") return null;
  if (body.birthday && !birthday) return null;
  if (traineeDays === null || !role) return null;
  if (role2 && role2 === role) return null;

  return {
    targetId,
    login,
    displayName,
    nick: cleanText(body.nick, 80) || null,
    avatar,
    tgUsername: cleanHandle(body.tg_username),
    instagram: cleanHandle(body.instagram),
    birthday,
    credo: cleanText(body.credo, 1000) || null,
    role,
    role2,
    displayRole: admin ? cleanText(body.display_role, 80) || null : current.display_role,
    traineeDays,
    canNotify: admin ? body.can_notify === true : current.can_notify === true,
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function internalEmail(legacyId: string): Promise<string> {
  const hash = await sha256(`tiflis:${legacyId}`);
  return `legacy-${hash.slice(0, 24)}@auth.tiflis.internal`;
}

function temporaryPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const token = Array.from(bytes).map((byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 18);
  return `Tf!${token}9a`;
}

function legacyId(): string {
  return `u_${Date.now()}_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
}

function safeStaff(staff: LegacyStaff, linked: Map<string, StaffProfile>, nextShift: Map<string, { date: string; shift: string }>, monthShifts: Map<string, number>) {
  const profile = linked.get(staff.id);
  return {
    id: staff.id,
    login: staff.login,
    displayName: staff.display_name || staff.login,
    nick: staff.nick,
    avatar: staff.avatar,
    role: normalizeRole(staff.id === "sysadmin" ? "sysadmin" : staff.role),
    role2: staff.role2 ? normalizeRole(staff.role2) : null,
    displayRole: staff.display_role,
    telegramUsername: staff.tg_username,
    telegramLinked: Boolean(staff.tg_id),
    instagram: staff.ig,
    fired: staff.fired === true,
    createdAt: staff.created_at,
    birthday: staff.birthday,
    traineeDays: Number(staff.trainee_days || 0),
    zodiac: staff.zodiac,
    canNotify: staff.can_notify === true,
    credo: staff.credo,
    credentialSource: staff.credential_source || "legacy",
    authLinked: Boolean(profile),
    nextShift: nextShift.get(staff.id) || null,
    monthShiftCount: monthShifts.get(staff.id) || 0,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(req, { ok: false, error: "Server configuration error" }, 503);
  }

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
    .select("user_id,legacy_user_id,role,role2,active,can_notify")
    .eq("user_id", authData.user.id)
    .single();
  const profile = rawProfile as StaffProfile | null;
  if (profileError || !profile || !profile.active || !profile.legacy_user_id) {
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

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (action === "staff_bootstrap") {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const monthStart = `${today.slice(0, 7)}-01`;
      const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

      const [usersResult, profilesResult, scheduleResult] = await Promise.all([
        admin.from("users").select("id,login,role,role2,display_name,nick,avatar,tg_id,tg_username,ig,fired,created_at,display_role,birthday,trainee_days,zodiac,can_notify,credo,credential_source,updated_at").order("fired", { ascending: true }).order("display_name", { ascending: true }),
        admin.from("staff_profiles").select("user_id,legacy_user_id,role,role2,active,can_notify"),
        admin.from("schedule").select("user_id,date,shift").gte("date", monthStart).lt("date", nextMonth).order("date", { ascending: true }),
      ]);
      if (usersResult.error) throw usersResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (scheduleResult.error) throw scheduleResult.error;

      const linked = new Map<string, StaffProfile>();
      for (const item of (profilesResult.data ?? []) as StaffProfile[]) {
        if (item.legacy_user_id) linked.set(item.legacy_user_id, item);
      }
      const nextShift = new Map<string, { date: string; shift: string }>();
      const monthShifts = new Map<string, number>();
      for (const row of scheduleResult.data ?? []) {
        const shift = String(row.shift || "");
        if (!shift || shift === "Х" || shift === "О") continue;
        const userId = String(row.user_id || "");
        monthShifts.set(userId, (monthShifts.get(userId) || 0) + 1);
        if (String(row.date) >= today && !nextShift.has(userId)) nextShift.set(userId, { date: String(row.date), shift });
      }

      const users = (usersResult.data ?? []) as LegacyStaff[];
      const roleKeys = [...new Set(users.flatMap((staff) => [staff.id === "sysadmin" ? "sysadmin" : normalizeRole(staff.role), staff.role2 ? normalizeRole(staff.role2) : null]).filter((role): role is string => Boolean(role)))];
      return json(req, {
        ok: true,
        me: { legacyUserId: profile.legacy_user_id, canManage: isAdmin(profile) },
        roles: roleKeys.map((key) => ({ key, label: ROLE_LABELS[key] || key })).sort((left, right) => left.label.localeCompare(right.label, "uk")),
        users: users.map((staff) => safeStaff(staff, linked, nextShift, monthShifts)),
      });
    }

    if (action === "staff_save") {
      const targetId = cleanText(body.user_id, 120);
      const { data: current, error: currentError } = await admin.from("users").select("id,login,role,role2,display_name,nick,avatar,tg_id,tg_username,ig,fired,created_at,display_role,birthday,trainee_days,zodiac,can_notify,credo,credential_source,updated_at").eq("id", targetId).single();
      if (currentError || !current) return json(req, { ok: false, error: "Staff member not found" }, 404);
      const manages = isAdmin(profile);
      if (!manages && targetId !== profile.legacy_user_id) return json(req, { ok: false, error: "Insufficient permissions" }, 403);
      if (targetId === "sysadmin" && profile.legacy_user_id !== "sysadmin") return json(req, { ok: false, error: "Protected account" }, 403);

      const parsed = parseStaffSave(body, current as LegacyStaff, manages);
      if (!parsed) return json(req, { ok: false, error: "Invalid staff profile" }, 400);

      const { error } = await admin.from("users").update({
        login: parsed.login,
        display_name: parsed.displayName,
        nick: parsed.nick,
        avatar: parsed.avatar,
        tg_username: parsed.tgUsername,
        ig: parsed.instagram,
        birthday: parsed.birthday,
        credo: parsed.credo,
        role: parsed.role,
        role2: parsed.role2,
        display_role: parsed.displayRole,
        trainee_days: parsed.traineeDays,
        can_notify: parsed.canNotify,
      }).eq("id", targetId);
      if (error) {
        if (error.code === "23505") return json(req, { ok: false, error: "Такий логін уже існує" }, 409);
        throw error;
      }

      if (manages) {
        const { error: profileUpdateError } = await admin.from("staff_profiles").update({
          display_name: parsed.displayName,
          role: targetId === "sysadmin" ? "sysadmin" : parsed.role,
          role2: parsed.role2,
          can_notify: parsed.canNotify,
        }).eq("legacy_user_id", targetId);
        if (profileUpdateError) throw profileUpdateError;
      } else {
        const { error: profileUpdateError } = await admin.from("staff_profiles").update({ display_name: parsed.displayName }).eq("legacy_user_id", targetId);
        if (profileUpdateError) throw profileUpdateError;
      }
      return json(req, { ok: true });
    }

    if (!isAdmin(profile)) return json(req, { ok: false, error: "Insufficient permissions" }, 403);

    if (action === "staff_create") {
      const login = cleanLogin(body.login);
      const displayName = cleanText(body.display_name, 120);
      const role = parseRole(body.role);
      const role2 = parseRole(body.role2, true);
      if (!validLogin(login) || !displayName || !role || role === "sysadmin" || role2 === role) {
        return json(req, { ok: false, error: "Invalid staff member" }, 400);
      }

      const id = legacyId();
      const password = temporaryPassword();
      const email = await internalEmail(id);
      const { data: authUser, error: authCreateError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { legacy_user_id: id, source: "tiflis-staff-admin" },
      });
      if (authCreateError || !authUser.user) throw authCreateError || new Error("Auth user creation failed");

      const avatar = parseAvatar(body.avatar);
      if (avatar === "invalid") {
        await admin.auth.admin.deleteUser(authUser.user.id);
        return json(req, { ok: false, error: "Invalid avatar URL" }, 400);
      }

      const marker = `AUTH_ONLY:${crypto.randomUUID()}`;
      const { error: legacyCreateError } = await admin.from("users").insert({
        id,
        login,
        password: marker,
        credential_source: "auth",
        role,
        role2,
        display_name: displayName,
        nick: cleanText(body.nick, 80) || null,
        avatar,
        tg_username: cleanHandle(body.tg_username),
        ig: cleanHandle(body.instagram),
        fired: false,
        display_role: cleanText(body.display_role, 80) || null,
        birthday: parseDate(body.birthday),
        trainee_days: parseTraineeDays(body.trainee_days) ?? 0,
        can_notify: body.can_notify === true,
        credo: cleanText(body.credo, 1000) || null,
      });
      if (legacyCreateError) {
        await admin.auth.admin.deleteUser(authUser.user.id);
        if (legacyCreateError.code === "23505") return json(req, { ok: false, error: "Такий логін уже існує" }, 409);
        throw legacyCreateError;
      }

      const { error: profileCreateError } = await admin.from("staff_profiles").insert({
        user_id: authUser.user.id,
        legacy_user_id: id,
        display_name: displayName,
        role,
        role2,
        active: true,
        can_notify: body.can_notify === true,
      });
      if (profileCreateError) {
        await admin.from("users").delete().eq("id", id);
        await admin.auth.admin.deleteUser(authUser.user.id);
        throw profileCreateError;
      }

      return json(req, { ok: true, userId: id, login, temporaryPassword: password });
    }

    if (action === "staff_set_active") {
      const targetId = cleanText(body.user_id, 120);
      const active = body.active === true;
      if (!targetId || targetId === "sysadmin" || targetId === profile.legacy_user_id && !active) {
        return json(req, { ok: false, error: "Protected account" }, 400);
      }
      const [legacyUpdate, profileUpdate] = await Promise.all([
        admin.from("users").update({ fired: !active }).eq("id", targetId),
        admin.from("staff_profiles").update({ active }).eq("legacy_user_id", targetId),
      ]);
      if (legacyUpdate.error) throw legacyUpdate.error;
      if (profileUpdate.error) throw profileUpdate.error;
      return json(req, { ok: true });
    }

    const targetId = cleanText(body.user_id, 120);
    if (!targetId) return json(req, { ok: false, error: "Invalid staff member" }, 400);
    const { data: mapped, error: mappedError } = await admin.from("staff_profiles").select("user_id").eq("legacy_user_id", targetId).single();
    if (mappedError || !mapped) return json(req, { ok: false, error: "Auth account is not linked yet" }, 409);
    const password = temporaryPassword();
    const { error: resetError } = await admin.auth.admin.updateUserById(String(mapped.user_id), { password });
    if (resetError) throw resetError;
    await admin.from("users").update({ credential_source: "auth", password: `AUTH_ONLY:${crypto.randomUUID()}` }).eq("id", targetId);
    return json(req, { ok: true, temporaryPassword: password });
  } catch (error) {
    console.error("tiflis-staff-api failed", error);
    return json(req, { ok: false, error: "Operation failed" }, 502);
  }
});
