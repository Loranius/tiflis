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

type AdminActorRow = {
  login: string | null;
  display_name: string | null;
};

// Edge Functions use the service client without a generated Database schema.
// Keep this small boundary untyped instead of allowing Supabase's inferred
// `never` table types to leak into otherwise checked business logic.
type UntypedSupabaseClient = any;

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

async function actorName(client: UntypedSupabaseClient, legacyId: string): Promise<string> {
  const { data } = await client
    .from("users")
    .select("login,display_name")
    .eq("id", legacyId)
    .maybeSingle() as { data: AdminActorRow | null };
  return String(data?.display_name || data?.login || "Адміністратор");
}

async function audit(
  client: UntypedSupabaseClient,
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
      const [
        configResult,
        activeUsers,
        linkedProfiles,
        pendingRegistrations,
        activeReservations,
        openNotifications,
        auditResult,
      ] = await Promise.all([
        admin.from("portal_config").select("*").eq("id", true).maybeSingle(),
        countQuery(admin.from("users").select("id", { count: "exact", head: true }).or("fired.is.null,fired.eq.false")),
        countQuery(admin.from("staff_profiles").select("user_id", { count: "exact", head: true }).eq("active", true)),
        countQuery(admin.from("registration_requests").select("id", { count: "exact", head: true }).eq("status", "pending")),
        countQuery(admin.from("reserve_bookings").select("id", { count: "exact", head: true }).gte("booking_date", new Date().toISOString().slice(0, 10)).neq("status", "cancelled")),
        countQuery(admin.from("portal_notifications").select("id", { count: "exact", head: true }).eq("status", "published")),
        admin.from("audit_log").select("id,actor_name,action,entity_type,entity_id,summary,metadata,created_at").order("created_at", { ascending: false }).limit(30),
      ]);
      if (configResult.error) throw configResult.error;
      if (auditResult.error) throw auditResult.error;

      const config = configResult.data as PortalConfig | null;
      return json(req, {
        ok: true,
        config: config || {
          id: true,
          portal_name: "Тифліс · портал персоналу",
          maintenance_mode: false,
          announcement_enabled: false,
          announcement_title: null,
          announcement_body: null,
          announcement_priority: "medium",
          updated_by: null,
          updated_at: new Date().toISOString(),
        },
        metrics: {
          activeUsers,
          linkedProfiles,
          pendingRegistrations,
          activeReservations,
          openNotifications,
        },
        roleMatrix: ROLE_MATRIX,
        modules: MODULES,
        audit: auditResult.data || [],
      });
    }

    if (action === "admin_save_config") {
      const portalName = cleanText(body.portal_name, 120) || "Тифліс · портал персоналу";
      const maintenanceMode = body.maintenance_mode === true;
      const announcementEnabled = body.announcement_enabled === true;
      const announcementTitle = cleanText(body.announcement_title, 160);
      const announcementBody = cleanText(body.announcement_body, 2000);
      const announcementPriority = parsePriority(body.announcement_priority);
      if (!announcementPriority) return json(req, { ok: false, error: "Invalid priority" }, 400);
      if (announcementEnabled && (!announcementTitle || !announcementBody)) {
        return json(req, { ok: false, error: "Announcement title and body are required" }, 400);
      }

      const { data, error } = await admin.from("portal_config").upsert({
        id: true,
        portal_name: portalName,
        maintenance_mode: maintenanceMode,
        announcement_enabled: announcementEnabled,
        announcement_title: announcementTitle || null,
        announcement_body: announcementBody || null,
        announcement_priority: announcementPriority,
        updated_by: profile.legacy_user_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" }).select("*").single();
      if (error) throw error;
      await audit(admin, profile.legacy_user_id, actor, "config.update", "portal_config", "Оновлено налаштування порталу", "portal", {
        maintenanceMode,
        announcementEnabled,
        announcementPriority,
      });
      return json(req, { ok: true, config: data });
    }

    if (action === "admin_publish_notification") {
      const title = cleanText(body.title, 160);
      const message = cleanText(body.message, 3000);
      const priority = parsePriority(body.priority);
      const roles = parseRoles(body.roles);
      const sendTelegramCopy = body.send_telegram === true;
      if (!title || !message || !priority) return json(req, { ok: false, error: "Invalid notification" }, 400);

      const { data: notification, error: notificationError } = await admin.from("portal_notifications").insert({
        title,
        message,
        priority,
        roles,
        status: "published",
        send_telegram: sendTelegramCopy,
        created_by: profile.legacy_user_id,
        published_at: new Date().toISOString(),
      }).select("*").single();
      if (notificationError) throw notificationError;

      let telegramSent = 0;
      let telegramSkipped = 0;
      if (sendTelegramCopy) {
        const usersResult = await admin
          .from("users")
          .select("chat_id,tg_id,role,role2,fired")
          .or("fired.is.null,fired.eq.false");
        if (usersResult.error) throw usersResult.error;
        for (const user of usersResult.data || []) {
          const userRoles = [normalizeRole(user.role), normalizeRole(user.role2)];
          if (roles.length > 0 && !userRoles.some((role) => roles.includes(role))) continue;
          const destination = user.chat_id || user.tg_id;
          if (!destination) {
            telegramSkipped += 1;
            continue;
          }
          const sent = await sendTelegram(destination, `${title}\n\n${message}`);
          if (sent) telegramSent += 1;
          else telegramSkipped += 1;
        }
      }

      await audit(admin, profile.legacy_user_id, actor, "notification.publish", "portal_notification", `Опубліковано повідомлення «${title}»`, String(notification.id), {
        priority,
        roles,
        sendTelegramCopy,
        telegramSent,
        telegramSkipped,
      });
      return json(req, { ok: true, notification, telegramSent, telegramSkipped });
    }

    if (action === "admin_cleanup_notifications") {
      const before = typeof body.before === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.before)
        ? body.before
        : new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
      const { data: rows, error: selectError } = await admin
        .from("portal_notifications")
        .select("id")
        .lt("created_at", `${before}T00:00:00.000Z`)
        .neq("status", "published");
      if (selectError) throw selectError;
      const ids = (rows || []).map((row) => row.id);
      if (ids.length > 0) {
        const { error } = await admin.from("portal_notifications").delete().in("id", ids);
        if (error) throw error;
      }
      await audit(admin, profile.legacy_user_id, actor, "notification.cleanup", "portal_notification", `Очищено ${ids.length} застарілих повідомлень`, null, { before, count: ids.length });
      return json(req, { ok: true, deleted: ids.length, before });
    }

    const linkedProfilesResult = await admin.from("staff_profiles").select("legacy_user_id").not("legacy_user_id", "is", null).eq("active", true);
    if (linkedProfilesResult.error) throw linkedProfilesResult.error;
    const ids = [...new Set((linkedProfilesResult.data || []).map((profileRow) => String(profileRow.legacy_user_id || "")).filter(Boolean))];
    let scrubbed = 0;
    for (const id of ids) {
      const { error } = await admin.from("users").update({
        password: authMarker(),
        session_token: authMarker(),
      }).eq("id", id);
      if (error) throw error;
      scrubbed += 1;
    }
    await audit(admin, profile.legacy_user_id, actor, "credentials.scrub", "users", `Очищено legacy-облікові дані для ${scrubbed} Auth-профілів`, null, { scrubbed });
    return json(req, { ok: true, scrubbed });
  } catch (error) {
    console.error("tiflis-admin-api failed", error);
    return json(req, { ok: false, error: "Operation failed" }, 502);
  }
});
