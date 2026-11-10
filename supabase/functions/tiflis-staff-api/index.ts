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
  "birthdays_bootstrap",
  "birthdays_save",
  "birthdays_delete",
  "staff_upload_avatar",
]);
const AVATAR_BUCKET = "images";
const AVATAR_PREFIX = "avatars/";
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const AVATAR_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const ADMIN_ROLES = new Set(["admin", "sysadmin"]);
const BIRTHDAY_POSITIONS = new Set([
  "admin", "bartender", "waiter", "hostess", "runner", "sommelier",
  "head_chef", "cook", "cook_assistant", "housekeeping", "facilities",
  "purchasing",
]);
const BIRTHDAY_COOK_DETAILS = new Set(["hot", "cold", "pastry", "grill"]);
const BIRTHDAY_HOUSEKEEPING_DETAILS = new Set(["cleaner", "wash_white", "wash_black"]);
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

function parseBirthdayPosition(value: unknown, allowEmpty = false): string | null | "invalid" {
  const position = cleanText(value, 30);
  if (!position) return allowEmpty ? null : "invalid";
  return BIRTHDAY_POSITIONS.has(position) ? position : "invalid";
}

function parseBirthdayPositionDetail(position: string | null, value: unknown): string | null | "invalid" {
  const detail = cleanText(value, 30) || null;
  if (position === "cook") return !detail || BIRTHDAY_COOK_DETAILS.has(detail) ? detail : "invalid";
  if (position === "housekeeping") return !detail || BIRTHDAY_HOUSEKEEPING_DETAILS.has(detail) ? detail : "invalid";
  return detail ? "invalid" : null;
}

function parseBirthdayDate(
  monthValue: unknown,
  dayValue: unknown,
): { month: number; day: number } | null | "invalid" {
  const hasMonth = monthValue !== null && monthValue !== undefined && monthValue !== "";
  const hasDay = dayValue !== null && dayValue !== undefined && dayValue !== "";
  if (!hasMonth && !hasDay) return null;
  if (hasMonth !== hasDay) return "invalid";

  const month = Number(monthValue);
  const day = Number(dayValue);
  if (!Number.isInteger(month) || month < 1 || month > 12) return "invalid";
  if (!Number.isInteger(day) || day < 1 || day > 31) return "invalid";

  const REFERENCE_LEAP_YEAR = 2028;
  const probe = new Date(Date.UTC(REFERENCE_LEAP_YEAR, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return "invalid";
  return { month, day };
}

function parseStaffSave(body: Record<string, unknown>, current: LegacyStaff, admin: boolean): StaffSaveInput | null {
  const targetId = cleanText(body.user_id, 120);
  const login = admin ? cleanLogin(body.login) : current.login;
  const displayName = cleanText(body.display_name, 120);
  const rawAvatar = cleanText(body.avatar, 1000);
  const avatar = rawAvatar && rawAvatar === current.avatar ? current.avatar : parseAvatar(body.avatar);
  const birthday = parseDate(body.birthday);
  const traineeDays = admin ? parseTraineeDays(body.trainee_days) : Number(current.trainee_days || 0);
  const role = admin ? parseRole(body.role) : normalizeRole(current.role);
  const role2 = admin ? parseRole(body.role2, true) : current.role2;

  // A non-admin never changes their login, so a legacy login that predates the rule must not block their own save.
  if (!targetId || !displayName || (admin && !validLogin(login)) || avatar === "invalid") return null;
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

/* Session check without a round-trip to Auth: the access token is verified
   locally against the project's signing keys (ES256; the key set is fetched
   once and cached by this isolate's client). Whether the person may still act
   is decided by their staff profile, read from the database on every request. */
function createTokenVerifier() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
let tokenVerifier: ReturnType<typeof createTokenVerifier> | null = null;

async function verifiedUserId(authorization: string): Promise<string> {
  tokenVerifier ??= createTokenVerifier();
  const { data, error } = await tokenVerifier.auth.getClaims(authorization.slice(7).trim());
  const claims = data?.claims;
  if (error || !claims || claims.role !== "authenticated" || typeof claims.sub !== "string") return "";
  return claims.sub;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Метод не підтримується" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(req, { ok: false, error: "Сервер налаштовано неправильно" }, 503);
  }

  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return json(req, { ok: false, error: "Потрібно увійти" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authUserId = await verifiedUserId(authorization);
  if (!authUserId) return json(req, { ok: false, error: "Сесія закінчилась, увійди ще раз" }, 401);

  const { data: rawProfile, error: profileError } = await userClient
    .from("staff_profiles")
    .select("user_id,legacy_user_id,role,role2,active,can_notify")
    .eq("user_id", authUserId)
    .single();
  const profile = rawProfile as StaffProfile | null;
  if (profileError || !profile || !profile.active || !profile.legacy_user_id) {
    return json(req, { ok: false, error: "Потрібен активний профіль працівника" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { ok: false, error: "Некоректний запит" }, 400);
  }
  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.has(action)) return json(req, { ok: false, error: "Невідома дія" }, 400);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (action === "staff_bootstrap") {
      // Dates are Kyiv calendar days; the window covers this month (for the count) and 35 days ahead (next shift).
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date());
      const monthStart = `${today.slice(0, 7)}-01`;
      const [year, month] = today.split("-").map(Number);
      const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
      const horizon = new Date(Date.parse(`${today}T00:00:00Z`) + 35 * 86_400_000).toISOString().slice(0, 10);
      const scheduleEnd = horizon > nextMonth ? horizon : nextMonth;

      const [usersResult, profilesResult, scheduleResult] = await Promise.all([
        admin.from("users").select("id,login,role,role2,display_name,nick,avatar,tg_id,tg_username,ig,fired,created_at,display_role,birthday,trainee_days,zodiac,can_notify,credo,credential_source,updated_at").order("fired", { ascending: true }).order("display_name", { ascending: true }),
        admin.from("staff_profiles").select("user_id,legacy_user_id,role,role2,active,can_notify"),
        admin.from("schedule").select("user_id,date,shift").gte("date", monthStart).lt("date", scheduleEnd).order("date", { ascending: true }),
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
        if (String(row.date) < nextMonth) monthShifts.set(userId, (monthShifts.get(userId) || 0) + 1);
        if (String(row.date) >= today && !nextShift.has(userId)) nextShift.set(userId, { date: String(row.date), shift });
      }

      const manages = isAdmin(profile);
      // Account state (login, sign-in, archive) is for admins only.
      const users = ((usersResult.data ?? []) as LegacyStaff[]).filter((staff) => manages || staff.fired !== true);
      const roleKeys = [...new Set(users.flatMap((staff) => [staff.id === "sysadmin" ? "sysadmin" : normalizeRole(staff.role), staff.role2 ? normalizeRole(staff.role2) : null]).filter((role): role is string => Boolean(role)))];
      return json(req, {
        ok: true,
        me: { legacyUserId: profile.legacy_user_id, canManage: manages },
        roles: roleKeys.map((key) => ({ key, label: ROLE_LABELS[key] || key })).sort((left, right) => left.label.localeCompare(right.label, "uk")),
        users: users.map((staff) => {
          const safe = safeStaff(staff, linked, nextShift, monthShifts);
          // Non-admins never see a login, including through the display-name fallback.
          return manages ? safe : { ...safe, displayName: staff.display_name || staff.nick || "Без імені", login: "", authLinked: false, credentialSource: "" };
        }),
      });
    }

    if (action === "staff_save") {
      const targetId = cleanText(body.user_id, 120);
      const { data: current, error: currentError } = await admin.from("users").select("id,login,role,role2,display_name,nick,avatar,tg_id,tg_username,ig,fired,created_at,display_role,birthday,trainee_days,zodiac,can_notify,credo,credential_source,updated_at").eq("id", targetId).single();
      if (currentError || !current) return json(req, { ok: false, error: "Працівника не знайдено" }, 404);
      const manages = isAdmin(profile);
      if (!manages && targetId !== profile.legacy_user_id) return json(req, { ok: false, error: "Недостатньо прав" }, 403);
      if (targetId === "sysadmin" && profile.legacy_user_id !== "sysadmin") return json(req, { ok: false, error: "Цей акаунт захищений" }, 403);

      const parsed = parseStaffSave(body, current as LegacyStaff, manages);
      if (!parsed) return json(req, { ok: false, error: "Перевір логін, імʼя, роль і дату" }, 400);

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

      // One birthday: the roster row linked to this account (used by the tab and the Telegram reminder) follows the profile.
      if (parsed.birthday) {
        const { error: rosterError } = await admin.from("staff_birthdays").update({
          birthday_month: Number(parsed.birthday.slice(5, 7)),
          birthday_day: Number(parsed.birthday.slice(8, 10)),
          updated_by: profile.legacy_user_id,
        }).eq("user_id", targetId);
        if (rosterError) throw rosterError;
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

    if (action === "staff_upload_avatar") {
      // The upload is unbound: it only returns a URL, which staff_save / staff_create / birthdays_save then store.
      // Anyone may upload for themselves; naming another colleague (or no one, for a new hire) needs an admin.
      const targetId = cleanText(body.user_id, 120);
      if (targetId !== profile.legacy_user_id && !isAdmin(profile)) {
        return json(req, { ok: false, error: "Недостатньо прав" }, 403);
      }
      const contentType = cleanText(body.content_type, 40);
      const extension = AVATAR_TYPES[contentType];
      const rawData = cleanText(body.data, 6_000_000);
      if (!extension || !rawData) return json(req, { ok: false, error: "Непідтримуваний формат фото" }, 400);
      const base64 = rawData.includes(",") ? rawData.slice(rawData.indexOf(",") + 1) : rawData;
      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      } catch {
        return json(req, { ok: false, error: "Некоректні дані фото" }, 400);
      }
      if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) {
        return json(req, { ok: false, error: "Фото завелике (максимум 3 МБ)" }, 400);
      }
      const path = `${AVATAR_PREFIX}${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await admin.storage.from(AVATAR_BUCKET).upload(path, bytes, { contentType, upsert: false });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      return json(req, { ok: true, avatar: publicUrl.publicUrl });
    }

    if (action === "birthdays_bootstrap") {
      const { data, error } = await admin
        .from("staff_birthdays")
        .select("id,full_name,position,position_detail,position2,position2_detail,birthday_month,birthday_day,avatar,user_id,updated_at")
        .order("full_name", { ascending: true });
      if (error) throw error;
      const canManage = isAdmin(profile);
      // Admins link roster entries to portal accounts so the day-before
      // Telegram reminder skips the birthday person.
      let accounts: { id: string; display_name: string | null; login: string }[] = [];
      if (canManage) {
        const accountsResult = await admin
          .from("users")
          .select("id,display_name,login")
          .or("fired.is.null,fired.eq.false")
          .order("display_name", { ascending: true });
        if (accountsResult.error) throw accountsResult.error;
        accounts = accountsResult.data ?? [];
      }
      return json(req, {
        ok: true,
        permissions: { canManage },
        people: data ?? [],
        accounts,
      });
    }

    if (!isAdmin(profile)) return json(req, { ok: false, error: "Недостатньо прав" }, 403);

    if (action === "staff_create") {
      const login = cleanLogin(body.login);
      const displayName = cleanText(body.display_name, 120);
      const role = parseRole(body.role);
      const role2 = parseRole(body.role2, true);
      if (!validLogin(login) || !displayName || !role || role === "sysadmin" || role2 === role) {
        return json(req, { ok: false, error: "Перевір логін, імʼя і роль" }, 400);
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
        return json(req, { ok: false, error: "Некоректне посилання на фото" }, 400);
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
        return json(req, { ok: false, error: "Цей акаунт захищений" }, 400);
      }
      const [legacyUpdate, profileUpdate] = await Promise.all([
        admin.from("users").update({ fired: !active }).eq("id", targetId),
        admin.from("staff_profiles").update({ active }).eq("legacy_user_id", targetId),
      ]);
      if (legacyUpdate.error) throw legacyUpdate.error;
      if (profileUpdate.error) throw profileUpdate.error;
      return json(req, { ok: true });
    }

    if (action === "birthdays_save") {
      const id = Number(body.id);
      const hasId = Number.isInteger(id) && id > 0;
      const fullName = cleanText(body.full_name, 120);
      const position = parseBirthdayPosition(body.position);
      const position2 = parseBirthdayPosition(body.position2, true);
      if (!fullName || position === "invalid" || position2 === "invalid") {
        return json(req, { ok: false, error: "Перевір імʼя і посаду" }, 400);
      }
      if (position2 && position2 === position) {
        return json(req, { ok: false, error: "Друга посада має відрізнятись від першої" }, 400);
      }
      const positionDetail = parseBirthdayPositionDetail(position, body.position_detail);
      const position2Detail = parseBirthdayPositionDetail(position2, body.position2_detail);
      if (positionDetail === "invalid" || position2Detail === "invalid") {
        return json(req, { ok: false, error: "Некоректне уточнення посади" }, 400);
      }
      const birthday = parseBirthdayDate(body.birthday_month, body.birthday_day);
      if (birthday === "invalid") return json(req, { ok: false, error: "Некоректна дата народження" }, 400);
      const avatar = parseAvatar(body.avatar);
      if (avatar === "invalid") return json(req, { ok: false, error: "Некоректне посилання на фото" }, 400);
      // Only touch the account link when the client sends it, so older
      // frontends that don't know about user_id never wipe existing links.
      const updatesLink = Object.prototype.hasOwnProperty.call(body, "user_id");
      const linkedUserId = cleanText(body.user_id, 120) || null;
      if (linkedUserId) {
        const { data: account, error: accountError } = await admin.from("users").select("id").eq("id", linkedUserId).maybeSingle();
        if (accountError) throw accountError;
        if (!account) return json(req, { ok: false, error: "Акаунт не знайдено" }, 400);
      }

      const row = {
        full_name: fullName,
        position,
        position_detail: positionDetail,
        position2,
        position2_detail: position2Detail,
        birthday_month: birthday?.month ?? null,
        birthday_day: birthday?.day ?? null,
        avatar,
        ...(updatesLink ? { user_id: linkedUserId } : {}),
        updated_by: profile.legacy_user_id,
      };

      const { data, error } = hasId
        ? await admin.from("staff_birthdays").update(row).eq("id", id).select("id").maybeSingle()
        : await admin.from("staff_birthdays").insert(row).select("id").single();
      if (error) throw error;
      if (hasId && !data) return json(req, { ok: false, error: "Запис не знайдено" }, 404);
      return json(req, { ok: true, id: (data as { id: number }).id });
    }

    if (action === "birthdays_delete") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) return json(req, { ok: false, error: "Перевір імʼя і посаду" }, 400);
      const { error } = await admin.from("staff_birthdays").delete().eq("id", id);
      if (error) throw error;
      return json(req, { ok: true });
    }

    const targetId = cleanText(body.user_id, 120);
    if (!targetId) return json(req, { ok: false, error: "Перевір логін, імʼя і роль" }, 400);
    if (targetId === "sysadmin" && profile.legacy_user_id !== "sysadmin") {
      return json(req, { ok: false, error: "Цей акаунт захищений" }, 403);
    }
    const { data: mapped, error: mappedError } = await admin.from("staff_profiles").select("user_id").eq("legacy_user_id", targetId).single();
    if (mappedError || !mapped) return json(req, { ok: false, error: "Працівник ще жодного разу не входив — пароль поки не скинути" }, 409);
    const password = temporaryPassword();
    const { error: resetError } = await admin.auth.admin.updateUserById(String(mapped.user_id), { password });
    if (resetError) throw resetError;
    await admin.from("users").update({ credential_source: "auth", password: `AUTH_ONLY:${crypto.randomUUID()}` }).eq("id", targetId);
    return json(req, { ok: true, temporaryPassword: password });
  } catch (error) {
    console.error("tiflis-staff-api failed", error);
    return json(req, { ok: false, error: "Не вдалося виконати дію, спробуй ще раз" }, 502);
  }
});
