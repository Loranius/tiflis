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

const ACTIONS = new Set([
  "admin_bootstrap",
  "admin_save_config",
  "admin_publish_notification",
  "admin_cleanup_notifications",
  "admin_scrub_linked_credentials",
]);
const ADMIN_ROLES = new Set(["admin", "sysadmin"]);
const PRIORITIES = new Set(["low", "medium", "high", "critical"]);

const ROLE_MATRIX = [
  { role: "sysadmin", label: "Сисадмін", pages: ["today", "schedule", "cash", "menu", "reserve", "staff", "admin"], actions: ["all"] },
  { role: "admin", label: "Адміністрація", pages: ["today", "schedule", "cash", "menu", "reserve", "staff", "admin"], actions: ["editSchedule", "editMenu", "manageReserve", "manageUsers", "seeAllCash", "broadcast"] },
  { role: "chef", label: "Шеф-кухар", pages: ["today", "schedule", "menu", "staff"], actions: ["editOwnShift", "toggleStop", "editMenu"] },
  { role: "cook", label: "Кухня", pages: ["today", "schedule", "menu", "staff"], actions: ["editOwnShift", "toggleStop"] },
  { role: "waiter", label: "Офіціант", pages: ["today", "schedule", "cash", "menu", "reserve", "staff"], actions: ["editOwnShift", "manageReserve"] },
  { role: "bar", label: "Бар", pages: ["today", "schedule", "cash", "menu", "staff"], actions: ["editOwnShift"] },
  { role: "hostess", label: "Хостес", pages: ["today", "schedule", "menu", "reserve", "staff"], actions: ["editOwnShift", "manageReserve"] },
  { role: "runner", label: "Ранер", pages: ["today", "staff"], actions: [] },
  { role: "sommelier", label: "Сомельє", pages: ["today", "schedule", "menu", "staff"], actions: ["editOwnShift"] },
];

const MODULES = [
  { key: "auth", label: "Auth та сесії", api: "tiflis-auth-migrate" },
  { key: "schedule", label: "Графік", api: "tiflis-secure-api" },
  { key: "cash", label: "Каса та рейтинг", api: "tiflis-secure-api" },
  { key: "menu", label: "Меню та стоп-лист", api: "tiflis-menu-api" },
  { key: "reserve", label: "Резерви", api: "tiflis-reserve-api" },
  { key: "staff", label: "Персонал", api: "tiflis-staff-api" },
  { key: "admin", label: "Управління", api: "tiflis-admin-api" },
];

type StaffProfile = {
  legacy_user_id: string | null;
  role: string;
  role2: string | null;
  active: boolean;
};

type PortalConfig = {
  id: boolean;
  portal_name: string;
  maintenance_mode: boolean;
  announcement_enabled: boolean;
  announcement_title: string | null;
  announcement_body: string | null;
  announcement_priority: string;
  updated_by: string | null;
  updated_at: string;
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

function isAdmin(profile: StaffProfile): boolean {
  return profile.active && [normalizeRole(profile.role), normalizeRole(profile.role2)]
    .some((role) => ADMIN_ROLES.has(role));
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parsePriority(value: unknown): string | null {
  const priority = cleanText(value, 20).toLowerCase();
  return PRIORITIES.has(priority) ? priority : null;
}

function parseRoles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => normalizeRole(item.trim()))
      .filter(Boolean),
  )].slice(0, 20);
}

function authMarker(): string {
  return `AUTH_ONLY:${crypto.randomUUID()}`;
}

async function actorName(client: ReturnType<typeof createClient>, legacyId: string): Promise<string> {
  const { data } = await client
    .from("users")
    .select("login,display_name")
    .eq("id", legacyId)
    .maybeSingle();
  return String(data?.display_name || data?.login || "Адміністратор");
}

async function audit(
  client: ReturnType<typeof createClient>,
  actorId: string,
  actor: string,
  action: string,
  entityType: string,
  summary: string,
  entityId?: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await client.from("audit_log").insert({
    actor_id: actorId,
    actor_name: actor,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    summary,
    metadata,
  });
  if (error) console.error("audit insert failed", error);
}

async function countQuery(
  promise: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  const result = await promise;
  if (result.error) return 0;
  return Number(result.count || 0);
}

async function sendTelegram(chatId: number | string, text: string): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  const numericChatId = Number(chatId);
  if (!Number.isSafeInteger(numericChatId)) return false;
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: numericChatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  return response.ok;
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
  if (profileError || !profile || !profile.legacy_user_id || !isAdmin(profile)) {
    return json(req, { ok: false, error: "Administrator access required" }, 403);
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
  const actor = await actorName(admin, profile.legacy_user_id);

  try {
    if (action === "admin_bootstrap") {
      const today = new Date().toISOString().slice(0, 10);
      const inThirtyDays = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
      const [
        activeStaff,
        archivedStaff,
        authOnlyStaff,
        legacyStaff,
        linkedProfiles,
        menuItems,
        stoppedItems,
        todayReservations,
        upcomingReservations,
        scheduleRows,
        configResult,
        notificationsResult,
        auditResult,
      ] = await Promise.all([
        countQuery(admin.from("users").select("id", { count: "exact", head: true }).or("fired.is.null,fired.eq.false")),
        countQuery(admin.from("users").select("id", { count: "exact", head: true }).eq("fired", true)),
        countQuery(admin.from("users").select("id", { count: "exact", head: true }).eq("credential_source", "auth")),
        countQuery(admin.from("users").select("id", { count: "exact", head: true }).eq("credential_source", "legacy")),
        countQuery(admin.from("staff_profiles").select("user_id", { count: "exact", head: true })),
        countQuery(admin.from("menu_items").select("id", { count: "exact", head: true })),
        countQuery(admin.from("menu_items").select("id", { count: "exact", head: true }).eq("stopped", true)),
        countQuery(admin.from("reservations").select("id", { count: "exact", head: true }).eq("reserved_date", today).in("status", ["booked", "occupied"])),
        countQuery(admin.from("reservations").select("id", { count: "exact", head: true }).gte("reserved_date", today).lte("reserved_date", inThirtyDays).in("status", ["booked", "occupied"])),
        countQuery(admin.from("schedule").select("id", { count: "exact", head: true }).gte("date", today)),
        admin.from("portal_config").select("*").eq("id", true).single<PortalConfig>(),
        admin.from("notifications").select("id,title,body,priority,author,roles,expires_at,created_at").order("created_at", { ascending: false }).limit(12),
        admin.from("audit_log").select("id,actor_id,actor_name,action,entity_type,entity_id,summary,metadata,created_at").order("created_at", { ascending: false }).limit(30),
      ]);

      if (configResult.error) throw configResult.error;
      if (notificationsResult.error) throw notificationsResult.error;
      if (auditResult.error) throw auditResult.error;

      return json(req, {
        ok: true,
        metrics: {
          activeStaff,
          archivedStaff,
          authOnlyStaff,
          legacyStaff,
          linkedProfiles,
          menuItems,
          stoppedItems,
          todayReservations,
          upcomingReservations,
          scheduleRows,
        },
        config: configResult.data,
        notifications: notificationsResult.data ?? [],
        audit: auditResult.data ?? [],
        roleMatrix: ROLE_MATRIX,
        modules: MODULES,
      });
    }

    if (action === "admin_save_config") {
      const portalName = cleanText(body.portal_name, 80) || "Тифліс";
      const title = cleanText(body.announcement_title, 180) || null;
      const announcementBody = cleanText(body.announcement_body, 3500) || null;
      const priority = parsePriority(body.announcement_priority);
      if (!priority) return json(req, { ok: false, error: "Invalid priority" }, 400);

      const payload = {
        portal_name: portalName,
        maintenance_mode: body.maintenance_mode === true,
        announcement_enabled: body.announcement_enabled === true,
        announcement_title: title,
        announcement_body: announcementBody,
        announcement_priority: priority,
        updated_by: actor,
      };
      const { data, error } = await admin
        .from("portal_config")
        .update(payload)
        .eq("id", true)
        .select("*")
        .single();
      if (error) throw error;
      await audit(admin, profile.legacy_user_id, actor, "portal_config_updated", "portal_config", "Оновлено конфігурацію порталу", "main", {
        maintenanceMode: payload.maintenance_mode,
        announcementEnabled: payload.announcement_enabled,
      });
      return json(req, { ok: true, config: data });
    }

    if (action === "admin_cleanup_notifications") {
      const now = new Date().toISOString();
      const { data, error } = await admin
        .from("notifications")
        .delete()
        .not("expires_at", "is", null)
        .lt("expires_at", now)
        .select("id");
      if (error) throw error;
      const removed = data?.length || 0;
      await audit(admin, profile.legacy_user_id, actor, "expired_notifications_removed", "notifications", `Видалено прострочених повідомлень: ${removed}`, null, { removed });
      return json(req, { ok: true, removed });
    }

    if (action === "admin_scrub_linked_credentials") {
      const { data: profiles, error: profilesError } = await admin
        .from("staff_profiles")
        .select("legacy_user_id")
        .not("legacy_user_id", "is", null);
      if (profilesError) throw profilesError;
      const ids = (profiles ?? []).map((item) => String(item.legacy_user_id)).filter(Boolean);
      let scrubbed = 0;
      for (const id of ids) {
        const { data, error } = await admin
          .from("users")
          .update({ credential_source: "auth", password: authMarker() })
          .eq("id", id)
          .neq("credential_source", "auth")
          .select("id");
        if (error) throw error;
        scrubbed += data?.length || 0;
      }
      await audit(admin, profile.legacy_user_id, actor, "linked_credentials_scrubbed", "users", `Знищено legacy-паролів пов’язаних акаунтів: ${scrubbed}`, null, { scrubbed });
      return json(req, { ok: true, scrubbed });
    }

    const title = cleanText(body.title, 180);
    const notificationBody = cleanText(body.body, 3500);
    const priority = parsePriority(body.priority);
    const roles = parseRoles(body.roles);
    const expiresAtRaw = cleanText(body.expires_at, 40);
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
    if (!title || !notificationBody || !priority || (expiresAt && Number.isNaN(expiresAt.getTime()))) {
      return json(req, { ok: false, error: "Invalid notification" }, 400);
    }

    const { data: inserted, error: insertError } = await admin
      .from("notifications")
      .insert({
        title,
        body: notificationBody,
        priority,
        author: actor,
        roles: roles.length ? roles.join(",") : null,
        expires_at: expiresAt?.toISOString() || null,
      })
      .select("id,title,body,priority,author,roles,expires_at,created_at")
      .single();
    if (insertError) throw insertError;

    let telegramSent = 0;
    let telegramSkipped = 0;
    if (body.telegram === true && BOT_TOKEN) {
      const { data: recipients, error: recipientsError } = await admin
        .from("users")
        .select("chat_id,tg_id,role,role2,fired")
        .or("fired.is.null,fired.eq.false");
      if (recipientsError) throw recipientsError;
      const message = `${title}\n\n${notificationBody}`;
      for (const recipient of recipients ?? []) {
        if (roles.length && !roles.includes(normalizeRole(recipient.role)) && !roles.includes(normalizeRole(recipient.role2))) continue;
        const destination = recipient.chat_id || recipient.tg_id;
        if (!destination) {
          telegramSkipped += 1;
          continue;
        }
        if (await sendTelegram(destination, message)) telegramSent += 1;
        else telegramSkipped += 1;
      }
    }

    await audit(admin, profile.legacy_user_id, actor, "notification_published", "notifications", `Опубліковано повідомлення «${title}»`, String(inserted.id), {
      priority,
      roles,
      telegram: body.telegram === true,
      telegramSent,
      telegramSkipped,
    });
    return json(req, { ok: true, notification: inserted, telegramSent, telegramSkipped });
  } catch (error) {
    console.error("tiflis-admin-api failed", error);
    return json(req, { ok: false, error: "Operation failed" }, 502);
  }
});
