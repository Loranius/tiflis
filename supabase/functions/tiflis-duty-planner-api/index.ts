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
  "planner_bootstrap",
  "planner_save",
  "planner_publish",
  "planner_set_status",
]);
const ADMIN_ROLES = new Set(["admin", "sysadmin"]);
const PLAN_TYPES = new Set(["daily", "handover"]);
const OFF_WAITER_SHIFTS = new Set(["Х", "О", "С"]);

const DAILY_DUTIES = [
  { key: "daily_clean_hall", title: "Прибирання залу (парапети, підвіконня, тумби, столешні, тумба з вином, дзеркало)" },
  { key: "daily_fireplace_terrace_doors", title: "Камінний зал, двері на літню терасу" },
  { key: "daily_drinks_bread_dining", title: "Узвар, лимонад, хліб, хлібний столик, їдальня" },
  { key: "daily_refrigerators", title: "Хол. з узваром, бар, кондитерський холодильник, холодильник з морозивом, холодильник з соусами" },
  { key: "daily_tablecloths", title: "Розкладання скатерок" },
  { key: "daily_booths_storage", title: "Кабінки, комора" },
  { key: "daily_sets", title: "Сети" },
  { key: "daily_drawer_third", title: "Дровер на 3-й позиції (чистота і фраже)" },
  { key: "daily_new_hall", title: "Новий зал (столи, стільці, спецовниці)" },
  { key: "daily_summer_terrace_cleaning", title: "Прибирання літньої тераси" },
  { key: "daily_evening_flower_watering", title: "Полив квітів ввечері" },
] as const;

const HANDOVER_DUTIES = [
  { key: "handover_storage_back_doors", title: "Комора, двоє дверей на чорному ході" },
  { key: "handover_rkeeper_shelves", title: "R-keeper, біля нього, полиці під графінами і шампанським на всіх позиціях" },
  { key: "handover_trays_tablets", title: "Розноси, планшетки" },
  { key: "handover_spice_sets", title: "Спецовниці: зал, кабінки, літня тераса, камінний зал" },
  { key: "handover_windows_hall", title: "Підвіконня, вхідні двері, вікна на хостесі, дзеркало, дивани і тумбочки в холі з усіх сторін, перило, перегородки в залі" },
  { key: "handover_hall_shelves", title: "Усі полиці в залі і все, що на них є, плафони, колонки, стільці в залі" },
  { key: "handover_drawers", title: "Дровери (3 шт.)" },
  { key: "handover_beams_chandeliers", title: "Балки, люстри" },
  { key: "handover_fireplace_hall", title: "Камінний зал: стільці, пилюка, люстри, телевізор, вікна" },
  { key: "handover_new_hall", title: "Новий зал: колонки, сабвуфери, плафони, стільці, спецовниці" },
  { key: "handover_cobwebs", title: "Павутиння: зал, вулиця-вхід, коридори" },
  { key: "handover_booths", title: "Кабінки: коридор, плазми, дровери, стільці, підвіконня" },
  { key: "handover_bar_sink", title: "Раковина на барі та робоче місце на барі" },
  { key: "handover_ice_buckets", title: "Відра для льоду та шампанського, полиці під ними" },
  { key: "handover_dining_bread_fridge", title: "Їдальня, хлібний столик зверху і всередині, холодильник" },
  { key: "handover_children_room", title: "Дитяча кімната" },
] as const;

const DAILY_ZONES = [
  { key: "zone_main_hall", title: "Загальний зал" },
  { key: "zone_booths", title: "Кабінки" },
  { key: "zone_fireplace_hall", title: "Камінний зал" },
  { key: "zone_lower_hall_2", title: "Нижній зал №2" },
  { key: "zone_lower_hall_3", title: "Нижній зал №3" },
  { key: "zone_summer_terrace", title: "Літня тераса" },
] as const;

type PlanType = "daily" | "handover";
type StaffProfile = {
  legacy_user_id: string | null;
  role: string;
  role2: string | null;
  active: boolean;
};
type LegacyUser = {
  id: string;
  login: string;
  display_name: string | null;
  role: string;
  role2: string | null;
  avatar: string | null;
  tg_id: number | null;
  chat_id: number | null;
  fired: boolean | null;
};
type ScheduleRow = { user_id: string; shift: string | null };
type DutyAssignment = {
  id: number;
  plan_type: PlanType;
  work_date: string;
  duty_key: string;
  assignee_id: string;
  status: "pending" | "done";
  completed_by: string | null;
  completed_at: string | null;
};
type ZoneAssignment = {
  id: number;
  work_date: string;
  zone_key: string;
  slot: number;
  assignee_id: string;
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
    .filter((role, index, all) => Boolean(role) && all.indexOf(role) === index);
}

function isAdmin(profile: StaffProfile): boolean {
  return profile.active && profileRoles(profile).some((role) => ADMIN_ROLES.has(role));
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function parsePlanType(value: unknown): PlanType | null {
  const type = cleanText(value, 20);
  return PLAN_TYPES.has(type) ? type as PlanType : null;
}

function parsePositiveId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function dutyDefinitions(type: PlanType) {
  return type === "daily" ? DAILY_DUTIES : HANDOVER_DUTIES;
}

function isWaiter(user: LegacyUser): boolean {
  return normalizeRole(user.role) === "waiter" || normalizeRole(user.role2) === "waiter";
}

function workingWaiters(users: LegacyUser[], schedule: ScheduleRow[]) {
  const shifts = new Map(schedule.map((row) => [String(row.user_id), String(row.shift || "").trim()]));
  return users
    .filter((user) => user.fired !== true && isWaiter(user))
    .map((user) => ({ user, shift: shifts.get(user.id) || "" }))
    .filter(({ shift }) => Boolean(shift) && !OFF_WAITER_SHIFTS.has(shift))
    .map(({ user, shift }) => ({
      id: user.id,
      name: user.display_name || user.login,
      shift,
      avatar: user.avatar,
      telegramLinked: Boolean(user.chat_id || user.tg_id),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "uk"));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDateUk(value: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Kyiv",
  }).format(new Date(`${value}T12:00:00+03:00`));
}

async function sendTelegram(destination: number | null, text: string): Promise<boolean> {
  if (!BOT_TOKEN || !destination || !Number.isSafeInteger(destination)) return false;
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: destination,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  return response.ok;
}

async function writeAudit(
  service: any,
  actor: LegacyUser,
  action: string,
  summary: string,
  entityId: string,
): Promise<void> {
  const { error } = await service.from("audit_log").insert({
    actor_id: actor.id,
    actor_name: actor.display_name || actor.login,
    action,
    entity_type: "duty_plan",
    entity_id: entityId,
    summary,
  });
  if (error) console.error("duty planner audit failed", error);
}

async function loadPlan(service: any, type: PlanType, date: string) {
  const [usersResult, scheduleResult, dutiesResult, zonesResult, publicationResult] = await Promise.all([
    service.from("users")
      .select("id,login,display_name,role,role2,avatar,tg_id,chat_id,fired")
      .or("fired.is.null,fired.eq.false"),
    service.from("schedule").select("user_id,shift").eq("date", date).not("shift", "is", null),
    service.from("ops_duty_plan_assignments")
      .select("id,plan_type,work_date,duty_key,assignee_id,status,completed_by,completed_at")
      .eq("plan_type", type)
      .eq("work_date", date),
    type === "daily"
      ? service.from("ops_zone_plan_assignments")
        .select("id,work_date,zone_key,slot,assignee_id")
        .eq("work_date", date)
        .order("zone_key")
        .order("slot")
      : Promise.resolve({ data: [], error: null }),
    service.from("ops_plan_publications")
      .select("plan_type,work_date,published_by,published_at,telegram_sent,telegram_skipped")
      .eq("plan_type", type)
      .eq("work_date", date)
      .maybeSingle(),
  ]);

  if (usersResult.error) throw usersResult.error;
  if (scheduleResult.error) throw scheduleResult.error;
  if (dutiesResult.error) throw dutiesResult.error;
  if (zonesResult.error) throw zonesResult.error;
  if (publicationResult.error) throw publicationResult.error;

  const users = (usersResult.data ?? []) as LegacyUser[];
  const schedule = (scheduleResult.data ?? []) as ScheduleRow[];
  const userMap = new Map(users.map((user) => [user.id, user]));
  const waiters = workingWaiters(users, schedule);
  const shifts = new Map(schedule.map((row) => [String(row.user_id), String(row.shift || "").trim()]));
  const enrichAssignee = (assigneeId: string) => {
    const user = userMap.get(assigneeId);
    return {
      assignee_name: user?.display_name || user?.login || assigneeId,
      assignee_shift: shifts.get(assigneeId) || null,
      assignee_working: waiters.some((waiter) => waiter.id === assigneeId),
    };
  };

  return {
    users,
    schedule,
    waiters,
    assignments: ((dutiesResult.data ?? []) as DutyAssignment[]).map((item) => ({
      ...item,
      ...enrichAssignee(item.assignee_id),
    })),
    zones: ((zonesResult.data ?? []) as ZoneAssignment[]).map((item) => ({
      ...item,
      ...enrichAssignee(item.assignee_id),
    })),
    publication: publicationResult.data || null,
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
  const action = cleanText(body.action, 50);
  if (!ACTIONS.has(action)) return json(req, { ok: false, error: "Unsupported action" }, 400);

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: actorData, error: actorError } = await service
    .from("users")
    .select("id,login,display_name,role,role2,avatar,tg_id,chat_id,fired")
    .eq("id", profile.legacy_user_id)
    .single();
  const actor = actorData as LegacyUser | null;
  if (actorError || !actor || actor.fired === true) {
    return json(req, { ok: false, error: "Staff member not found" }, 403);
  }

  try {
    if (action === "planner_bootstrap") {
      const type = parsePlanType(body.plan_type);
      const date = parseDate(body.date);
      if (!type || !date) return json(req, { ok: false, error: "Invalid plan date or type" }, 400);

      const plan = await loadPlan(service, type, date);
      const meShift = plan.schedule.find((row) => String(row.user_id) === actor.id)?.shift || null;
      return json(req, {
        ok: true,
        planType: type,
        date,
        definitions: dutyDefinitions(type),
        zones: type === "daily" ? DAILY_ZONES : [],
        workingWaiters: plan.waiters,
        assignments: plan.assignments,
        zoneAssignments: plan.zones,
        publication: plan.publication,
        me: {
          id: actor.id,
          name: actor.display_name || actor.login,
          shift: meShift,
        },
        permissions: { canManage: isAdmin(profile) },
      });
    }

    if (action === "planner_save") {
      if (!isAdmin(profile)) return json(req, { ok: false, error: "Insufficient permissions" }, 403);
      const type = parsePlanType(body.plan_type);
      const date = parseDate(body.date);
      if (!type || !date) return json(req, { ok: false, error: "Invalid plan date or type" }, 400);

      const rawAssignments = Array.isArray(body.assignments) ? body.assignments : [];
      const rawZones = Array.isArray(body.zones) ? body.zones : [];
      const allowedDutyKeys = new Set<string>(dutyDefinitions(type).map((item) => item.key));
      const allowedZoneKeys = new Set<string>(DAILY_ZONES.map((item) => item.key));
      const plan = await loadPlan(service, type, date);
      const workingIds = new Set(plan.waiters.map((waiter) => waiter.id));
      const seenDuties = new Set<string>();
      const assignments: { duty_key: string; assignee_id: string }[] = [];

      for (const raw of rawAssignments) {
        if (!raw || typeof raw !== "object") continue;
        const item = raw as Record<string, unknown>;
        const dutyKey = cleanText(item.duty_key, 80);
        const assigneeId = cleanText(item.assignee_id, 120);
        if (!dutyKey && !assigneeId) continue;
        if (!allowedDutyKeys.has(dutyKey) || !workingIds.has(assigneeId) || seenDuties.has(dutyKey)) {
          return json(req, { ok: false, error: "Обов’язки можна призначати лише офіціантам, які працюють у вибрану дату." }, 400);
        }
        seenDuties.add(dutyKey);
        assignments.push({ duty_key: dutyKey, assignee_id: assigneeId });
      }

      const zones: { zone_key: string; slot: number; assignee_id: string }[] = [];
      const seenZoneSlots = new Set<string>();
      const seenZonePeople = new Set<string>();
      if (type === "daily") {
        for (const raw of rawZones) {
          if (!raw || typeof raw !== "object") continue;
          const item = raw as Record<string, unknown>;
          const zoneKey = cleanText(item.zone_key, 80);
          const assigneeId = cleanText(item.assignee_id, 120);
          const slot = Number(item.slot);
          if (!zoneKey && !assigneeId) continue;
          const slotKey = `${zoneKey}:${slot}`;
          const personKey = `${zoneKey}:${assigneeId}`;
          if (
            !allowedZoneKeys.has(zoneKey)
            || !workingIds.has(assigneeId)
            || !Number.isInteger(slot)
            || slot < 1
            || slot > 3
            || seenZoneSlots.has(slotKey)
            || seenZonePeople.has(personKey)
          ) {
            return json(req, { ok: false, error: "На одну зону можна призначити до трьох різних офіціантів із графіка вибраного дня." }, 400);
          }
          seenZoneSlots.add(slotKey);
          seenZonePeople.add(personKey);
          zones.push({ zone_key: zoneKey, slot, assignee_id: assigneeId });
        }
      }

      const { data, error } = await service.rpc("replace_ops_duty_plan", {
        p_plan_type: type,
        p_work_date: date,
        p_assignments: assignments,
        p_zones: zones,
        p_actor: actor.display_name || actor.login,
      });
      if (error) throw error;
      await writeAudit(
        service,
        actor,
        "duty_plan_saved",
        `${type === "daily" ? "Щоденні обов’язки" : "Здачу зміни"} збережено: ${assignments.length} обов’язків, ${zones.length} призначень зон.`,
        `${type}:${date}`,
      );
      return json(req, { ok: true, result: data?.[0] || { duty_count: assignments.length, zone_count: zones.length } });
    }

    if (action === "planner_publish") {
      if (!isAdmin(profile)) return json(req, { ok: false, error: "Insufficient permissions" }, 403);
      const type = parsePlanType(body.plan_type);
      const date = parseDate(body.date);
      if (!type || !date) return json(req, { ok: false, error: "Invalid plan date or type" }, 400);

      const plan = await loadPlan(service, type, date);
      const workingIds = new Set(plan.waiters.map((waiter) => waiter.id));
      const dutyMap = new Map<string, string>(dutyDefinitions(type).map((item) => [item.key, item.title]));
      const zoneMap = new Map<string, string>(DAILY_ZONES.map((item) => [item.key, item.title]));
      const byUser = new Map<string, { duties: string[]; zones: string[] }>();
      const ensure = (id: string) => {
        const current = byUser.get(id) || { duties: [], zones: [] };
        byUser.set(id, current);
        return current;
      };

      for (const assignment of plan.assignments) {
        if (!workingIds.has(assignment.assignee_id)) continue;
        const title = dutyMap.get(assignment.duty_key);
        if (title) ensure(assignment.assignee_id).duties.push(title);
      }
      if (type === "daily") {
        for (const zone of plan.zones) {
          if (!workingIds.has(zone.assignee_id)) continue;
          const title = zoneMap.get(zone.zone_key);
          if (title) ensure(zone.assignee_id).zones.push(title);
        }
      }

      if (!byUser.size) {
        return json(req, { ok: false, error: "Спочатку призначте хоча б один обов’язок або заповніть зону." }, 400);
      }

      const userMap = new Map(plan.users.map((user) => [user.id, user]));
      const dateLabel = escapeHtml(formatDateUk(date));
      let sent = 0;
      let skipped = 0;
      const recipients: string[] = [];

      for (const [userId, personal] of byUser.entries()) {
        const user = userMap.get(userId);
        if (!user) continue;
        const name = user.display_name || user.login;
        const lines: string[] = [];
        if (type === "daily") lines.push(`☀️ <b>Обов’язки та зона · ${dateLabel}</b>`);
        else lines.push(`🔄 <b>Здача зміни · ${dateLabel}</b>`);
        lines.push(`\nПривіт, <b>${escapeHtml(name)}</b>!`);
        if (personal.duties.length) {
          lines.push("\n🧹 <b>Твої обов’язки:</b>");
          personal.duties.forEach((title) => lines.push(`• ${escapeHtml(title)}`));
        }
        if (type === "daily" && personal.zones.length) {
          lines.push("\n📍 <b>Твоя зона роботи:</b>");
          personal.zones.forEach((title) => lines.push(`• ${escapeHtml(title)}`));
        }
        lines.push(`\n— ${escapeHtml(actor.display_name || actor.login)}`);

        const destination = user.chat_id || user.tg_id;
        const delivered = await sendTelegram(destination, lines.join("\n"));
        if (delivered) {
          sent += 1;
          recipients.push(name);
        } else skipped += 1;
      }

      const { error: publicationError } = await service.from("ops_plan_publications").upsert({
        plan_type: type,
        work_date: date,
        published_by: actor.display_name || actor.login,
        published_at: new Date().toISOString(),
        telegram_sent: sent,
        telegram_skipped: skipped,
      }, { onConflict: "plan_type,work_date" });
      if (publicationError) throw publicationError;

      await writeAudit(
        service,
        actor,
        "duty_plan_published",
        `${type === "daily" ? "Щоденні обов’язки" : "Здачу зміни"} надіслано: ${sent}, без Telegram: ${skipped}.`,
        `${type}:${date}`,
      );
      return json(req, { ok: true, sent, skipped, recipients });
    }

    const assignmentId = parsePositiveId(body.assignment_id);
    const status = cleanText(body.status, 20);
    if (!assignmentId || !new Set(["pending", "done"]).has(status)) {
      return json(req, { ok: false, error: "Invalid assignment status" }, 400);
    }
    const { data: assignment, error: assignmentError } = await service
      .from("ops_duty_plan_assignments")
      .select("id,assignee_id")
      .eq("id", assignmentId)
      .single();
    if (assignmentError || !assignment) return json(req, { ok: false, error: "Assignment not found" }, 404);
    if (String(assignment.assignee_id) !== actor.id && !isAdmin(profile)) {
      return json(req, { ok: false, error: "Insufficient permissions" }, 403);
    }
    const done = status === "done";
    const { data, error } = await service.from("ops_duty_plan_assignments").update({
      status,
      completed_by: done ? actor.display_name || actor.login : null,
      completed_at: done ? new Date().toISOString() : null,
    }).eq("id", assignmentId).select("id,status,completed_by,completed_at").single();
    if (error) throw error;
    return json(req, { ok: true, assignment: data });
  } catch (error) {
    console.error("tiflis-duty-planner-api failed", error);
    return json(req, { ok: false, error: "Не вдалося виконати операцію з обов’язками." }, 502);
  }
});
