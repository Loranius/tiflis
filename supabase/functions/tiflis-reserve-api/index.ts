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
  "reserve_bootstrap",
  "reserve_save",
  "reserve_delete",
]);
const MANAGE_ROLES = new Set(["admin", "sysadmin", "hostess", "waiter"]);
const NOTIFY_ROLES = new Set(["waiter"]);
const STATUSES = new Set(["booked", "occupied", "completed", "cancelled", "no_show"]);

type StaffProfile = {
  legacy_user_id: string | null;
  role: string;
  role2: string | null;
  active: boolean;
};

type HallRow = {
  id: number;
  name: string;
  sort_order: number;
  note: string | null;
  active: boolean;
};

type TableRow = {
  id: number;
  hall_id: number;
  label: string;
  capacity: number;
  kind: string;
  position_x: number | string | null;
  position_y: number | string | null;
  sort_order: number;
  active: boolean;
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
  phone: string | null;
  menu_note: string | null;
  note: string | null;
  status: string;
  merged_tables: string[] | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type ReservationInput = {
  id: number | null;
  hallId: number;
  tableId: number;
  date: string;
  time: string;
  durationMinutes: number;
  guests: number;
  guestName: string;
  phone: string | null;
  menuNote: string | null;
  note: string | null;
  status: string;
  mergedTables: string[];
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

function canManage(profile: StaffProfile): boolean {
  return profile.active && profileRoles(profile).some((role) => MANAGE_ROLES.has(role));
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parsePositiveId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function parseTime(value: unknown): string | null {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return value;
}

function parseInteger(value: unknown, min: number, max: number): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function parseMergedTables(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().slice(0, 40))
      .filter(Boolean),
  )].slice(0, 20);
}

function parseReservation(body: Record<string, unknown>): ReservationInput | null {
  const id = body.id === null || body.id === undefined ? null : parsePositiveId(body.id);
  const hallId = parsePositiveId(body.hall_id);
  const tableId = parsePositiveId(body.table_id);
  const date = parseDate(body.date);
  const time = parseTime(body.time);
  const durationMinutes = parseInteger(body.duration_minutes, 15, 720);
  const guests = parseInteger(body.guests, 1, 300);
  const guestName = cleanText(body.guest_name, 180);
  const status = cleanText(body.status, 30) || "booked";

  if (!hallId || !tableId || !date || !time || !durationMinutes || !guests || !guestName) return null;
  if (!STATUSES.has(status)) return null;

  return {
    id,
    hallId,
    tableId,
    date,
    time,
    durationMinutes,
    guests,
    guestName,
    phone: cleanText(body.phone, 80) || null,
    menuNote: cleanText(body.menu_note, 1200) || null,
    note: cleanText(body.note, 2000) || null,
    status,
    mergedTables: parseMergedTables(body.merged_tables),
  };
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function minutes(value: string): number {
  const [hours = "0", mins = "0"] = value.slice(0, 5).split(":");
  return Number(hours) * 60 + Number(mins);
}

function overlaps(startA: number, durationA: number, startB: number, durationB: number): boolean {
  return startA < startB + durationB && startB < startA + durationA;
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
    timeZone: "Europe/Kyiv",
  }).format(new Date(`${value}T12:00:00+03:00`));
}

async function sendTelegram(destination: number | null, text: string): Promise<boolean> {
  if (!BOT_TOKEN || !destination || !Number.isSafeInteger(destination)) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: destination, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function notifyNewReservation(
  serviceClient: ReturnType<typeof createClient>,
  reservation: ReservationRow,
  hallName: string,
  tableLabel: string,
): Promise<void> {
  try {
    const { data, error } = await serviceClient
      .from("users")
      .select("role,role2,chat_id,tg_id,fired")
      .or("fired.is.null,fired.eq.false");
    if (error || !data) return;

    const tableLine = reservation.merged_tables?.length
      ? `${tableLabel} + ${reservation.merged_tables.join(", ")}`
      : tableLabel;
    const lines = [
      "🆕 <b>Нове бронювання</b>",
      `\n👤 ${escapeHtml(reservation.guest_name)}`,
      `👥 ${reservation.guests} ${reservation.guests === 1 ? "гість" : "гостей"}`,
      `🍽️ ${escapeHtml(hallName)}, стіл ${escapeHtml(tableLine)}`,
      `🕒 ${formatDateUk(reservation.reserved_date)} о ${reservation.reserved_time}`,
    ];
    const text = lines.join("\n");

    const recipients = data.filter((row: any) => {
      if (row.fired === true) return false;
      return NOTIFY_ROLES.has(normalizeRole(row.role)) || NOTIFY_ROLES.has(normalizeRole(row.role2));
    });
    await Promise.allSettled(recipients.map((row: any) => sendTelegram(row.chat_id || row.tg_id, text)));
  } catch (error) {
    console.error("tiflis-reserve-api notifyNewReservation failed", error);
  }
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

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (action === "reserve_bootstrap") {
      const selectedDate = parseDate(body.date);
      if (!selectedDate) return json(req, { ok: false, error: "Invalid date" }, 400);
      const from = addDays(selectedDate, -14);
      const to = addDays(selectedDate, 35);

      const [hallsResult, tablesResult, reservationsResult] = await Promise.all([
        serviceClient
          .from("reserve_halls")
          .select("id,name,sort_order,note,active")
          .eq("active", true)
          .order("sort_order", { ascending: true }),
        serviceClient
          .from("reserve_tables")
          .select("id,hall_id,label,capacity,kind,position_x,position_y,sort_order,active")
          .eq("active", true)
          .order("hall_id", { ascending: true })
          .order("sort_order", { ascending: true }),
        serviceClient
          .from("reservations")
          .select("id,hall_id,table_id,reserved_date,reserved_time,duration_minutes,guests,guest_name,phone,menu_note,note,status,merged_tables,created_by,updated_by,created_at,updated_at")
          .gte("reserved_date", from)
          .lte("reserved_date", to)
          .order("reserved_date", { ascending: true })
          .order("reserved_time", { ascending: true }),
      ]);
      if (hallsResult.error) throw hallsResult.error;
      if (tablesResult.error) throw tablesResult.error;
      if (reservationsResult.error) throw reservationsResult.error;

      return json(req, {
        ok: true,
        selectedDate,
        permissions: { canManage: canManage(profile) },
        halls: (hallsResult.data ?? []) as HallRow[],
        tables: (tablesResult.data ?? []) as TableRow[],
        reservations: (reservationsResult.data ?? []) as ReservationRow[],
      });
    }

    if (!canManage(profile)) {
      return json(req, { ok: false, error: "Insufficient permissions" }, 403);
    }

    if (action === "reserve_delete") {
      const id = parsePositiveId(body.id);
      if (!id) return json(req, { ok: false, error: "Invalid reservation" }, 400);
      const { error } = await serviceClient.from("reservations").delete().eq("id", id);
      if (error) throw error;
      return json(req, { ok: true });
    }

    const input = parseReservation(body);
    if (!input) return json(req, { ok: false, error: "Invalid reservation" }, 400);

    const [hallResult, tableResult, hallTablesResult, authorResult] = await Promise.all([
      serviceClient.from("reserve_halls").select("id,name,active").eq("id", input.hallId).single(),
      serviceClient.from("reserve_tables").select("id,hall_id,label,active").eq("id", input.tableId).single(),
      serviceClient.from("reserve_tables").select("id,label,capacity,active").eq("hall_id", input.hallId).eq("active", true),
      serviceClient.from("users").select("login,display_name").eq("id", profile.legacy_user_id).single(),
    ]);
    if (hallResult.error || !hallResult.data?.active) return json(req, { ok: false, error: "Hall not found" }, 404);
    if (tableResult.error || !tableResult.data?.active || tableResult.data.hall_id !== input.hallId) {
      return json(req, { ok: false, error: "Table not found" }, 404);
    }
    if (hallTablesResult.error) throw hallTablesResult.error;
    if (authorResult.error) throw authorResult.error;

    const hallTables = hallTablesResult.data ?? [];
    const labels = new Set(hallTables.map((table) => String(table.label)));
    const primaryLabel = String(tableResult.data.label);
    const mergedTables = input.mergedTables.filter((label) => label !== primaryLabel && labels.has(label));
    const requestedLabels = new Set([primaryLabel, ...mergedTables]);
    const requestedCapacity = hallTables
      .filter((table) => requestedLabels.has(String(table.label)))
      .reduce((sum, table) => sum + Number(table.capacity || 0), 0);

    const { data: sameDay, error: sameDayError } = await serviceClient
      .from("reservations")
      .select("id,table_id,reserved_time,duration_minutes,status,merged_tables")
      .eq("hall_id", input.hallId)
      .eq("reserved_date", input.date)
      .in("status", ["booked", "occupied"]);
    if (sameDayError) throw sameDayError;

    const tableLabelById = new Map(hallTables.map((table) => [Number(table.id), String(table.label)]));
    const requestedStart = minutes(input.time);
    const conflict = (sameDay ?? []).find((reservation) => {
      if (input.id && Number(reservation.id) === input.id) return false;
      const existingStart = minutes(String(reservation.reserved_time));
      if (!overlaps(requestedStart, input.durationMinutes, existingStart, Number(reservation.duration_minutes || 120))) {
        return false;
      }
      const existingLabels = new Set([
        tableLabelById.get(Number(reservation.table_id)) || "",
        ...((reservation.merged_tables || []) as string[]),
      ]);
      return [...requestedLabels].some((label) => existingLabels.has(label));
    });
    if (conflict) {
      return json(req, { ok: false, error: "Цей стіл уже зайнятий у вибраний час" }, 409);
    }

    const author = authorResult.data.display_name || authorResult.data.login || "Працівник";
    const payload = {
      hall_id: input.hallId,
      table_id: input.tableId,
      reserved_date: input.date,
      reserved_time: input.time,
      duration_minutes: input.durationMinutes,
      guests: input.guests,
      guest_name: input.guestName,
      phone: input.phone,
      menu_note: input.menuNote,
      note: input.note,
      status: input.status,
      merged_tables: mergedTables,
      updated_by: author,
    };

    if (input.id) {
      const { data, error } = await serviceClient
        .from("reservations")
        .update(payload)
        .eq("id", input.id)
        .select("id,hall_id,table_id,reserved_date,reserved_time,duration_minutes,guests,guest_name,phone,menu_note,note,status,merged_tables,created_by,updated_by,created_at,updated_at")
        .single();
      if (error || !data) throw error || new Error("Reservation not found");
      return json(req, { ok: true, reservation: data, capacity: requestedCapacity });
    }

    const { data, error } = await serviceClient
      .from("reservations")
      .insert({ ...payload, created_by: author })
      .select("id,hall_id,table_id,reserved_date,reserved_time,duration_minutes,guests,guest_name,phone,menu_note,note,status,merged_tables,created_by,updated_by,created_at,updated_at")
      .single();
    if (error) throw error;
    await notifyNewReservation(serviceClient, data as ReservationRow, String(hallResult.data.name), primaryLabel);
    return json(req, { ok: true, reservation: data, capacity: requestedCapacity });
  } catch (error) {
    console.error("tiflis-reserve-api failed", error);
    return json(req, { ok: false, error: "Operation failed" }, 502);
  }
});
