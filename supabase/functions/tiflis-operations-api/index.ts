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
  "operations_bootstrap",
  "operations_set_task",
  "operations_add_note",
  "operations_resolve_note",
  "operations_save_template",
]);
const ADMIN_ROLES = new Set(["admin", "sysadmin"]);
const TEMPLATE_ROLES = new Set(["admin", "sysadmin", "chef"]);
const PRIORITIES = new Set(["low", "medium", "high", "critical"]);
const CATEGORIES = new Set(["opening", "service", "closing", "handover"]);
const TASK_STATUSES = new Set(["pending", "done", "skipped"]);

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
  fired: boolean | null;
};

type TaskTemplate = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  role_scope: string[] | null;
  shift_codes: string[] | null;
  sort_order: number;
  active: boolean;
};

type Assignment = {
  id: number;
  template_id: number;
  work_date: string;
  assignee_id: string;
  status: string;
  note: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
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

function profileRoles(profile: StaffProfile): string[] {
  return [normalizeRole(profile.role), normalizeRole(profile.role2)].filter(
    (role, index, all) => Boolean(role) && all.indexOf(role) === index,
  );
}

function hasRole(profile: StaffProfile, allowed: Set<string>): boolean {
  return profile.active && profileRoles(profile).some((role) => allowed.has(role));
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parsePositiveId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseTextArray(value: unknown, maxItems = 30, maxLength = 40): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().slice(0, maxLength))
      .filter(Boolean),
  )].slice(0, maxItems);
}

function intersects(scope: string[] | null | undefined, roles: string[]): boolean {
  return !scope?.length || scope.some((role) => roles.includes(normalizeRole(role)));
}

async function actor(client: ReturnType<typeof createClient>, legacyId: string): Promise<LegacyUser> {
  const { data, error } = await client
    .from("users")
    .select("id,login,display_name,role,role2,avatar,fired")
    .eq("id", legacyId)
    .single();
  if (error || !data || data.fired === true) throw error || new Error("Staff member not found");
  return data as LegacyUser;
}

async function audit(
  client: ReturnType<typeof createClient>,
  staff: LegacyUser,
  action: string,
  entityType: string,
  summary: string,
  entityId?: string | null,
): Promise<void> {
  const { error } = await client.from("audit_log").insert({
    actor_id: staff.id,
    actor_name: staff.display_name || staff.login,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    summary,
  });
  if (error) console.error("operations audit failed", error);
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

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const current = await actor(service, profile.legacy_user_id);
  const roles = profileRoles(profile);

  try {
    if (action === "operations_bootstrap") {
      const date = parseDate(body.date);
      if (!date) return json(req, { ok: false, error: "Invalid date" }, 400);

      const [templatesResult, assignmentsResult, scheduleResult, usersResult, notesResult, notificationsResult] = await Promise.all([
        service.from("ops_task_templates").select("id,title,description,category,role_scope,shift_codes,sort_order,active").eq("active", true).order("category").order("sort_order"),
        service.from("ops_task_assignments").select("id,template_id,work_date,assignee_id,status,note,completed_by,completed_at,created_at,updated_at").eq("work_date", date).eq("assignee_id", current.id),
        service.from("schedule").select("user_id,date,shift").eq("date", date).not("shift", "is", null),
        service.from("users").select("id,login,display_name,role,role2,avatar,fired").or("fired.is.null,fired.eq.false"),
        service.from("ops_handover_notes").select("id,work_date,author_id,author_name,title,body,priority,role_scope,pinned,resolved_at,resolved_by,created_at").gte("work_date", addDays(date, -2)).lte("work_date", addDays(date, 1)).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(60),
        service.from("notifications").select("id,title,body,priority,author,roles,expires_at,created_at").or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order("created_at", { ascending: false }).limit(20),
      ]);
      if (templatesResult.error) throw templatesResult.error;
      if (assignmentsResult.error) throw assignmentsResult.error;
      if (scheduleResult.error) throw scheduleResult.error;
      if (usersResult.error) throw usersResult.error;
      if (notesResult.error) throw notesResult.error;
      if (notificationsResult.error) throw notificationsResult.error;

      const ownShift = (scheduleResult.data ?? []).find((row) => String(row.user_id) === current.id)?.shift || null;
      const applicable = ((templatesResult.data ?? []) as TaskTemplate[]).filter((template) => {
        return intersects(template.role_scope, roles) && (!template.shift_codes?.length || template.shift_codes.includes(String(ownShift || "")));
      });
      const assignments = (assignmentsResult.data ?? []) as Assignment[];
      const assignmentByTemplate = new Map(assignments.map((item) => [Number(item.template_id), item]));
      const missing = applicable.filter((template) => !assignmentByTemplate.has(template.id));
      if (missing.length) {
        const { data: created, error: createError } = await service
          .from("ops_task_assignments")
          .upsert(missing.map((template) => ({
            template_id: template.id,
            work_date: date,
            assignee_id: current.id,
          })), { onConflict: "template_id,work_date,assignee_id" })
          .select("id,template_id,work_date,assignee_id,status,note,completed_by,completed_at,created_at,updated_at");
        if (createError) throw createError;
        for (const item of (created ?? []) as Assignment[]) assignmentByTemplate.set(Number(item.template_id), item);
      }

      const userMap = new Map(((usersResult.data ?? []) as LegacyUser[]).map((user) => [user.id, user]));
      const team = (scheduleResult.data ?? [])
        .filter((row) => {
          const shift = String(row.shift || "");
          return shift && shift !== "Х" && shift !== "О";
        })
        .map((row) => {
          const user = userMap.get(String(row.user_id));
          return user ? {
            id: user.id,
            name: user.display_name || user.login,
            role: normalizeRole(user.role),
            role2: user.role2 ? normalizeRole(user.role2) : null,
            avatar: user.avatar,
            shift: String(row.shift),
          } : null;
        })
        .filter(Boolean);

      const notes = (notesResult.data ?? []).filter((note) => intersects(note.role_scope as string[] | null, roles));
      const notifications = (notificationsResult.data ?? []).filter((item) => {
        const scopes = typeof item.roles === "string"
          ? item.roles.split(",").map((role: string) => normalizeRole(role.trim())).filter(Boolean)
          : [];
        return !scopes.length || scopes.some((role: string) => roles.includes(role));
      });

      return json(req, {
        ok: true,
        date,
        me: {
          id: current.id,
          name: current.display_name || current.login,
          roles,
          shift: ownShift,
        },
        permissions: {
          canManageTemplates: hasRole(profile, TEMPLATE_ROLES),
          canResolveAny: hasRole(profile, ADMIN_ROLES),
        },
        tasks: applicable.map((template) => ({
          ...template,
          assignment: assignmentByTemplate.get(template.id) || null,
        })),
        team,
        notes,
        notifications,
      });
    }

    if (action === "operations_set_task") {
      const assignmentId = parsePositiveId(body.assignment_id);
      const status = cleanText(body.status, 20);
      if (!assignmentId || !TASK_STATUSES.has(status)) {
        return json(req, { ok: false, error: "Invalid task update" }, 400);
      }
      const { data: assignment, error: assignmentError } = await service
        .from("ops_task_assignments")
        .select("id,assignee_id")
        .eq("id", assignmentId)
        .single();
      if (assignmentError || !assignment) return json(req, { ok: false, error: "Task not found" }, 404);
      if (String(assignment.assignee_id) !== current.id && !hasRole(profile, ADMIN_ROLES)) {
        return json(req, { ok: false, error: "Insufficient permissions" }, 403);
      }
      const done = status === "done";
      const { data, error } = await service
        .from("ops_task_assignments")
        .update({
          status,
          note: cleanText(body.note, 1000) || null,
          completed_by: done ? current.display_name || current.login : null,
          completed_at: done ? new Date().toISOString() : null,
        })
        .eq("id", assignmentId)
        .select("id,template_id,work_date,assignee_id,status,note,completed_by,completed_at,created_at,updated_at")
        .single();
      if (error) throw error;
      return json(req, { ok: true, assignment: data });
    }

    if (action === "operations_add_note") {
      const date = parseDate(body.date);
      const title = cleanText(body.title, 180);
      const noteBody = cleanText(body.body, 3000);
      const priority = cleanText(body.priority, 20).toLowerCase() || "medium";
      if (!date || !title || !noteBody || !PRIORITIES.has(priority)) {
        return json(req, { ok: false, error: "Invalid handover note" }, 400);
      }
      const scope = parseTextArray(body.role_scope);
      const { data, error } = await service
        .from("ops_handover_notes")
        .insert({
          work_date: date,
          author_id: current.id,
          author_name: current.display_name || current.login,
          title,
          body: noteBody,
          priority,
          role_scope: scope,
          pinned: body.pinned === true && hasRole(profile, ADMIN_ROLES),
        })
        .select("id,work_date,author_id,author_name,title,body,priority,role_scope,pinned,resolved_at,resolved_by,created_at")
        .single();
      if (error) throw error;
      await audit(service, current, "handover_note_created", "ops_handover_notes", `Додано передачу зміни «${title}»`, String(data.id));
      return json(req, { ok: true, note: data });
    }

    if (action === "operations_resolve_note") {
      const noteId = parsePositiveId(body.id);
      if (!noteId) return json(req, { ok: false, error: "Invalid note" }, 400);
      const { data: note, error: noteError } = await service
        .from("ops_handover_notes")
        .select("id,author_id,resolved_at")
        .eq("id", noteId)
        .single();
      if (noteError || !note) return json(req, { ok: false, error: "Note not found" }, 404);
      if (String(note.author_id || "") !== current.id && !hasRole(profile, ADMIN_ROLES)) {
        return json(req, { ok: false, error: "Insufficient permissions" }, 403);
      }
      const resolve = body.resolved === true;
      const { data, error } = await service
        .from("ops_handover_notes")
        .update({
          resolved_at: resolve ? new Date().toISOString() : null,
          resolved_by: resolve ? current.display_name || current.login : null,
        })
        .eq("id", noteId)
        .select("id,work_date,author_id,author_name,title,body,priority,role_scope,pinned,resolved_at,resolved_by,created_at")
        .single();
      if (error) throw error;
      return json(req, { ok: true, note: data });
    }

    if (!hasRole(profile, TEMPLATE_ROLES)) {
      return json(req, { ok: false, error: "Insufficient permissions" }, 403);
    }
    const templateId = body.id ? parsePositiveId(body.id) : null;
    const title = cleanText(body.title, 180);
    const category = cleanText(body.category, 30).toLowerCase();
    if (!title || !CATEGORIES.has(category)) {
      return json(req, { ok: false, error: "Invalid task template" }, 400);
    }
    const payload = {
      title,
      description: cleanText(body.description, 2000) || null,
      category,
      role_scope: parseTextArray(body.role_scope),
      shift_codes: parseTextArray(body.shift_codes, 20, 20),
      sort_order: Math.max(0, Math.min(10000, Number(body.sort_order || 0) || 0)),
      active: body.active !== false,
      created_by: current.display_name || current.login,
    };
    const query = templateId
      ? service.from("ops_task_templates").update(payload).eq("id", templateId)
      : service.from("ops_task_templates").insert(payload);
    const { data, error } = await query
      .select("id,title,description,category,role_scope,shift_codes,sort_order,active")
      .single();
    if (error) throw error;
    await audit(service, current, templateId ? "task_template_updated" : "task_template_created", "ops_task_templates", `${templateId ? "Оновлено" : "Створено"} шаблон «${title}»`, String(data.id));
    return json(req, { ok: true, template: data });
  } catch (error) {
    console.error("tiflis-operations-api failed", error);
    return json(req, { ok: false, error: "Operation failed" }, 502);
  }
});
