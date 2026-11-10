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
  "reserve_status",
  "reserve_delete",
]);
const MANAGE_ROLES = new Set(["admin", "sysadmin", "hostess", "waiter"]);
const NOTIFY_ROLES = new Set(["waiter"]);
const NON_WORK_SHIFT_CODES = new Set(["", "Х", "О"]);
const STATUSES = new Set(["booked", "occupied", "completed", "cancelled", "no_show"]);
const LIVE_STATUSES = new Set(["booked", "occupied"]);
const RESERVATION_COLUMNS = "id,hall_id,table_id,reserved_date,reserved_time,duration_minutes,guests,guest_name,phone,menu_note,note,status,merged_tables,created_by,updated_by,created_at,updated_at";
/** A seated table stays taken at least this long past "now", even after its booked end. */
const SEATED_GRACE_MINUTES = 15;

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

type ScheduleRow = { user_id: string; shift: string | null };

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

function kyivNow(): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Length a live booking blocks its tables: the booked duration, stretched while guests are still seated today. */
function blockedMinutes(reservation: { reserved_time: string; duration_minutes: number | null; status: string }, date: string): number {
  const start = minutes(String(reservation.reserved_time));
  const duration = Number(reservation.duration_minutes || 120);
  if (reservation.status !== "occupied") return duration;
  const now = kyivNow();
  if (now.date !== date) return duration;
  return Math.max(duration, now.minutes + SEATED_GRACE_MINUTES - start);
}

type ConflictCheck = {
  id: number | null;
  hallId: number;
  date: string;
  time: string;
  durationMinutes: number;
  labels: Set<string>;
};

async function findConflict(serviceClient: any, check: ConflictCheck): Promise<boolean> {
  const [{ data: sameDay, error: sameDayError }, { data: hallTables, error: tablesError }] = await Promise.all([
    serviceClient
      .from("reservations")
      .select("id,table_id,reserved_time,duration_minutes,status,merged_tables")
      .eq("hall_id", check.hallId)
      .eq("reserved_date", check.date)
      .in("status", ["booked", "occupied"]),
    serviceClient.from("reserve_tables").select("id,label").eq("hall_id", check.hallId),
  ]);
  if (sameDayError) throw sameDayError;
  if (tablesError) throw tablesError;
  const tableLabelById = new Map((hallTables ?? []).map((table: { id: number; label: string }) => [Number(table.id), String(table.label)]));
  const requestedStart = minutes(check.time);
  return (sameDay ?? []).some((reservation: any) => {
    if (check.id && Number(reservation.id) === check.id) return false;
    const existingStart = minutes(String(reservation.reserved_time));
    if (!overlaps(requestedStart, check.durationMinutes, existingStart, blockedMinutes(reservation, check.date))) return false;
    const existingLabels = new Set([
      tableLabelById.get(Number(reservation.table_id)) || "",
      ...((reservation.merged_tables || []) as string[]),
    ]);
    return [...check.labels].some((label) => existingLabels.has(label));
  });
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
  serviceClient: any,
  reservation: ReservationRow,
  hallName: string,
  tableLabel: string,
): Promise<void> {
  try {
    const [usersResult, scheduleResult] = await Promise.all([
      serviceClient
        .from("users")
        .select("id,role,role2,chat_id,tg_id,fired")
        .or("fired.is.null,fired.eq.false"),
      serviceClient
        .from("schedule")
        .select("user_id,shift")
        .eq("date", reservation.reserved_date),
    ]);
    if (usersResult.error || !usersResult.data) return;
    if (scheduleResult.error) return;

    const shifts = new Map(
      ((scheduleResult.data ?? []) as ScheduleRow[]).map((row) => [String(row.user_id), String(row.shift || "").trim()]),
    );

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

    const recipients = usersResult.data.filter((row: any) => {
      if (row.fired === true) return false;
      if (!NOTIFY_ROLES.has(normalizeRole(row.role)) && !NOTIFY_ROLES.has(normalizeRole(row.role2))) return false;
      const shift = shifts.get(String(row.id)) || "";
      return !NON_WORK_SHIFT_CODES.has(shift);
    });
    await Promise.allSettled(recipients.map((row: any) => sendTelegram(row.chat_id || row.tg_id, text)));
  } catch (error) {
    console.error("tiflis-reserve-api notifyNewReservation failed", error);
  }
}

/* Session check without a round-trip to Auth: the access token is verified
   locally against the project's signing keys (ES256; the key set is fetched
   once and cached by this isolate's client). The database then confirms, in
   the same call that reads the staff profile, that the token's session is
   still open, so a signed-out or blocked person is refused at once. */
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
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return json(req, { ok: false, error: "Потрібно увійти" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authUserId = await verifiedUserId(authorization);
  if (!authUserId) return json(req, { ok: false, error: "Сесія закінчилась, увійди ще раз" }, 401);

  const { data: rawProfile, error: profileError } = await userClient
    // The profile comes back only while this token's session is still open
    // (see migration 20261110120000_session_profile.sql).
    .rpc("tiflis_session_profile")
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

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (action === "reserve_bootstrap") {
      const selectedDate = parseDate(body.date);
      if (!selectedDate) return json(req, { ok: false, error: "Некоректна дата" }, 400);
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
          .select(RESERVATION_COLUMNS)
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
      return json(req, { ok: false, error: "Недостатньо прав" }, 403);
    }

    const { data: authorRow } = await serviceClient.from("users").select("login,display_name").eq("id", profile.legacy_user_id).maybeSingle();
    const author = authorRow?.display_name || authorRow?.login || "Працівник";

    if (action === "reserve_delete") {
      const id = parsePositiveId(body.id);
      if (!id) return json(req, { ok: false, error: "Некоректний резерв" }, 400);
      const { error } = await serviceClient.from("reservations").delete().eq("id", id);
      if (error) throw error;
      return json(req, { ok: true });
    }

    if (action === "reserve_status") {
      // Changes only the status, so a tap never overwrites a concurrent edit. Closing a booking never conflicts;
      // reopening or seating it must still fit the table.
      const id = parsePositiveId(body.id);
      const status = cleanText(body.status, 30);
      if (!id || !STATUSES.has(status)) return json(req, { ok: false, error: "Некоректний статус" }, 400);
      const { data: current, error: currentError } = await serviceClient.from("reservations").select(RESERVATION_COLUMNS).eq("id", id).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return json(req, { ok: false, error: "Резерв не знайдено" }, 404);
      if (LIVE_STATUSES.has(status) && !LIVE_STATUSES.has(String(current.status))) {
        const { data: primary } = await serviceClient.from("reserve_tables").select("label").eq("id", current.table_id).maybeSingle();
        const conflict = await findConflict(serviceClient, {
          id,
          hallId: Number(current.hall_id),
          date: String(current.reserved_date),
          time: String(current.reserved_time).slice(0, 5),
          durationMinutes: Number(current.duration_minutes || 120),
          labels: new Set([String(primary?.label || ""), ...((current.merged_tables || []) as string[])].filter(Boolean)),
        });
        if (conflict) return json(req, { ok: false, error: "Цей стіл уже зайнятий у цей час — відкрий резерв і обери інший" }, 409);
      }
      const { data, error } = await serviceClient.from("reservations").update({ status, updated_by: author }).eq("id", id).select(RESERVATION_COLUMNS).single();
      if (error) throw error;
      return json(req, { ok: true, reservation: data });
    }

    const input = parseReservation(body);
    if (!input) return json(req, { ok: false, error: "Резерв не збережено: перевір дату, час, гостей, імʼя і стіл" }, 400);

    const [hallResult, tableResult, hallTablesResult] = await Promise.all([
      serviceClient.from("reserve_halls").select("id,name,active").eq("id", input.hallId).single(),
      serviceClient.from("reserve_tables").select("id,hall_id,label,active").eq("id", input.tableId).single(),
      serviceClient.from("reserve_tables").select("id,label,capacity,active").eq("hall_id", input.hallId).eq("active", true),
    ]);
    if (hallResult.error || !hallResult.data?.active) return json(req, { ok: false, error: "Зал не знайдено" }, 404);
    if (tableResult.error || !tableResult.data?.active || tableResult.data.hall_id !== input.hallId) {
      return json(req, { ok: false, error: "Стіл не знайдено" }, 404);
    }
    if (hallTablesResult.error) throw hallTablesResult.error;

    const hallTables = hallTablesResult.data ?? [];
    const labels = new Set(hallTables.map((table) => String(table.label)));
    const primaryLabel = String(tableResult.data.label);
    const mergedTables = input.mergedTables.filter((label) => label !== primaryLabel && labels.has(label));
    const requestedLabels = new Set([primaryLabel, ...mergedTables]);
    const requestedCapacity = hallTables
      .filter((table) => requestedLabels.has(String(table.label)))
      .reduce((sum, table) => sum + Number(table.capacity || 0), 0);

    if (LIVE_STATUSES.has(input.status)) {
      const conflict = await findConflict(serviceClient, {
        id: input.id,
        hallId: input.hallId,
        date: input.date,
        time: input.time,
        durationMinutes: input.durationMinutes,
        labels: requestedLabels,
      });
      if (conflict) return json(req, { ok: false, error: "Цей стіл уже зайнятий у вибраний час" }, 409);
    }

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
        .select(RESERVATION_COLUMNS)
        .single();
      if (error || !data) throw error || new Error("Reservation not found");
      return json(req, { ok: true, reservation: data, capacity: requestedCapacity });
    }

    const { data, error } = await serviceClient
      .from("reservations")
      .insert({ ...payload, created_by: author })
      .select(RESERVATION_COLUMNS)
      .single();
    if (error) throw error;
    await notifyNewReservation(serviceClient, data as ReservationRow, String(hallResult.data.name), primaryLabel);
    return json(req, { ok: true, reservation: data, capacity: requestedCapacity });
  } catch (error) {
    console.error("tiflis-reserve-api failed", error);
    return json(req, { ok: false, error: "Не вдалося зберегти, спробуй ще раз" }, 502);
  }
});
