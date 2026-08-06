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

const ACTIONS = new Set(["today_reservations_get"]);
const ACTIVE_STATUSES = new Set(["booked", "occupied"]);
const ZONE_HALLS = [
  { key: "zone_main_hall", title: "Загальний зал" },
  { key: "zone_booths", title: "Кабінки" },
  { key: "zone_fireplace_hall", title: "Камінний зал" },
  { key: "zone_lower_hall_2", title: "Нижній зал №2" },
  { key: "zone_lower_hall_3", title: "Нижній зал №3" },
  { key: "zone_summer_terrace", title: "Літня тераса" },
] as const;

type StaffProfile = {
  legacy_user_id: string | null;
  role: string;
  role2: string | null;
  active: boolean;
};

type HallRow = {
  id: number;
  name: string;
};

type TableRow = {
  id: number;
  hall_id: number;
  label: string;
};

type ReservationRow = {
  id: number;
  hall_id: number;
  table_id: number;
  reserved_date: string;
  reserved_time: string;
  duration_minutes: number;
  guests: number;
  guest_name: string;
  menu_note: string | null;
  note: string | null;
  status: string;
  merged_tables: string[] | null;
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
    .filter((role, index, roles) => Boolean(role) && roles.indexOf(role) === index);
}

function isWaiter(profile: StaffProfile): boolean {
  return profile.active && profileRoles(profile).includes("waiter");
}

function kyivParts(date = new Date()): { date: string; minutes: number; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const hours = Number(part("hour"));
  const mins = Number(part("minute"));
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minutes: hours * 60 + mins,
    time: `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`,
  };
}

function timeMinutes(value: string): number {
  const [hours = "0", mins = "0"] = value.slice(0, 5).split(":");
  return Number(hours) * 60 + Number(mins);
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

  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.has(action)) return json(req, { ok: false, error: "Unsupported action" }, 400);

  const now = kyivParts();
  if (!isWaiter(profile)) {
    return json(req, {
      ok: true,
      date: now.date,
      currentTime: now.time,
      canView: false,
      publication: false,
      zones: [],
      reservations: [],
    });
  }

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const [publicationResult, assignmentsResult, hallsResult] = await Promise.all([
      service
        .from("ops_plan_publications")
        .select("plan_type,work_date,published_at")
        .eq("plan_type", "daily")
        .eq("work_date", now.date)
        .maybeSingle(),
      service
        .from("ops_zone_plan_assignments")
        .select("zone_key")
        .eq("work_date", now.date)
        .eq("assignee_id", profile.legacy_user_id),
      service
        .from("reserve_halls")
        .select("id,name")
        .eq("active", true),
    ]);
    if (publicationResult.error) throw publicationResult.error;
    if (assignmentsResult.error) throw assignmentsResult.error;
    if (hallsResult.error) throw hallsResult.error;

    const published = Boolean(publicationResult.data);
    if (!published) {
      return json(req, {
        ok: true,
        date: now.date,
        currentTime: now.time,
        canView: true,
        publication: false,
        zones: [],
        reservations: [],
      });
    }

    const assignedKeys = new Set(
      (assignmentsResult.data ?? []).map((item) => String(item.zone_key)),
    );
    const assignedZones = ZONE_HALLS.filter((zone) => assignedKeys.has(zone.key));
    const halls = (hallsResult.data ?? []) as HallRow[];
    const hallByName = new Map(halls.map((hall) => [hall.name, hall]));
    const zones = assignedZones
      .map((zone) => {
        const hall = hallByName.get(zone.title);
        return hall ? { key: zone.key, title: zone.title, hallId: hall.id } : null;
      })
      .filter((zone): zone is { key: string; title: string; hallId: number } => Boolean(zone));

    if (!zones.length) {
      return json(req, {
        ok: true,
        date: now.date,
        currentTime: now.time,
        canView: true,
        publication: true,
        zones: [],
        reservations: [],
      });
    }

    const hallIds = zones.map((zone) => zone.hallId);
    const [tablesResult, reservationsResult] = await Promise.all([
      service
        .from("reserve_tables")
        .select("id,hall_id,label")
        .in("hall_id", hallIds)
        .eq("active", true),
      service
        .from("reservations")
        .select("id,hall_id,table_id,reserved_date,reserved_time,duration_minutes,guests,guest_name,menu_note,note,status,merged_tables")
        .eq("reserved_date", now.date)
        .in("hall_id", hallIds)
        .in("status", ["booked", "occupied"])
        .order("reserved_time", { ascending: true }),
    ]);
    if (tablesResult.error) throw tablesResult.error;
    if (reservationsResult.error) throw reservationsResult.error;

    const tableById = new Map(
      ((tablesResult.data ?? []) as TableRow[]).map((table) => [table.id, table]),
    );
    const hallById = new Map(halls.map((hall) => [hall.id, hall]));
    const reservations = ((reservationsResult.data ?? []) as ReservationRow[])
      .filter((reservation) => {
        if (!ACTIVE_STATUSES.has(reservation.status)) return false;
        if (reservation.status === "occupied") return true;
        const start = timeMinutes(reservation.reserved_time);
        return start + Number(reservation.duration_minutes || 120) >= now.minutes;
      })
      .sort((left, right) => {
        if (left.status === "occupied" && right.status !== "occupied") return -1;
        if (right.status === "occupied" && left.status !== "occupied") return 1;
        return left.reserved_time.localeCompare(right.reserved_time);
      })
      .slice(0, 6)
      .map((reservation) => ({
        id: reservation.id,
        time: reservation.reserved_time.slice(0, 5),
        durationMinutes: reservation.duration_minutes,
        guests: reservation.guests,
        guestName: reservation.guest_name,
        menuNote: reservation.menu_note,
        note: reservation.note,
        status: reservation.status,
        hallId: reservation.hall_id,
        hallName: hallById.get(reservation.hall_id)?.name || "Зал",
        tableId: reservation.table_id,
        tableLabel: tableById.get(reservation.table_id)?.label || "—",
        mergedTables: reservation.merged_tables || [],
      }));

    return json(req, {
      ok: true,
      date: now.date,
      currentTime: now.time,
      canView: true,
      publication: true,
      zones,
      reservations,
    });
  } catch (error) {
    console.error("today reservations api failed", error);
    return json(req, { ok: false, error: "Не вдалося завантажити резерви для ваших зон." }, 500);
  }
});
