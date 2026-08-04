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
  "menu_bootstrap",
  "menu_toggle_stop",
  "menu_save_item",
  "menu_delete_item",
]);
const STOP_ROLES = new Set(["admin", "sysadmin", "chef", "cook"]);
const EDIT_ROLES = new Set(["admin", "sysadmin", "chef"]);

type StaffProfile = {
  legacy_user_id: string | null;
  role: string;
  role2: string | null;
  active: boolean;
};

type MenuInput = {
  id: number | null;
  section: string;
  category: string;
  name: string;
  price: number | null;
  weight: string | null;
  description: string | null;
  photo: string | null;
  allergens: string[];
  cook_time_normal: number | null;
  cook_time_busy: number | null;
  emoji: string | null;
  stopped: boolean;
  sort_order: number;
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

function roles(profile: StaffProfile): string[] {
  return [normalizeRole(profile.role), normalizeRole(profile.role2)].filter(
    (role, index, all) => Boolean(role) && all.indexOf(role) === index,
  );
}

function hasAnyRole(profile: StaffProfile, allowed: Set<string>): boolean {
  return profile.active && roles(profile).some((role) => allowed.has(role));
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parsePositiveId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseNullableNumber(value: unknown, max: number): number | null | "invalid" {
  if (value === "" || value === null || value === undefined) return null;
  const normalized = typeof value === "string" ? value.replace(",", ".").trim() : value;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return "invalid";
  return Math.round(parsed * 100) / 100;
}

function parseNullableInteger(value: unknown, max: number): number | null | "invalid" {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) return "invalid";
  return parsed;
}

function parsePhoto(value: unknown): string | null | "invalid" {
  const photo = cleanText(value, 1000);
  if (!photo) return null;
  try {
    const url = new URL(photo);
    return url.protocol === "https:" ? url.toString() : "invalid";
  } catch {
    return "invalid";
  }
}

function parseAllergens(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().slice(0, 60))
      .filter(Boolean),
  )].slice(0, 30);
}

function parseMenuInput(body: Record<string, unknown>): MenuInput | null {
  const section = cleanText(body.section, 40).toLowerCase();
  const category = cleanText(body.category, 120);
  const name = cleanText(body.name, 180);
  const price = parseNullableNumber(body.price, 10_000_000);
  const normal = parseNullableInteger(body.cook_time_normal, 1440);
  const busy = parseNullableInteger(body.cook_time_busy, 1440);
  const photo = parsePhoto(body.photo);
  const sortOrderRaw = body.sort_order === undefined ? 0 : Number(body.sort_order);
  const sortOrder = Number.isInteger(sortOrderRaw) && sortOrderRaw >= 0 && sortOrderRaw <= 100_000
    ? sortOrderRaw
    : 0;

  if (!/^[a-z0-9_-]{1,40}$/.test(section) || !category || !name) return null;
  if (price === "invalid" || normal === "invalid" || busy === "invalid" || photo === "invalid") return null;

  return {
    id: parsePositiveId(body.id),
    section,
    category,
    name,
    price,
    weight: cleanText(body.weight, 100) || null,
    description: cleanText(body.description, 3000) || null,
    photo,
    allergens: parseAllergens(body.allergens),
    cook_time_normal: normal,
    cook_time_busy: busy,
    emoji: cleanText(body.emoji, 16) || null,
    stopped: body.stopped === true,
    sort_order: sortOrder,
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
    if (action === "menu_bootstrap") {
      const { data, error } = await serviceClient
        .from("menu_items")
        .select("id,section,category,name,price,weight,description,photo,allergens,cook_time_normal,cook_time_busy,emoji,stopped,sort_order,updated_at")
        .order("section", { ascending: true })
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;

      return json(req, {
        ok: true,
        permissions: {
          canToggleStop: hasAnyRole(profile, STOP_ROLES),
          canEdit: hasAnyRole(profile, EDIT_ROLES),
        },
        items: data ?? [],
      });
    }

    if (action === "menu_toggle_stop") {
      if (!hasAnyRole(profile, STOP_ROLES)) {
        return json(req, { ok: false, error: "Insufficient permissions" }, 403);
      }
      const id = parsePositiveId(body.id);
      if (!id || typeof body.stopped !== "boolean") {
        return json(req, { ok: false, error: "Invalid menu item" }, 400);
      }
      const { data, error } = await serviceClient
        .from("menu_items")
        .update({ stopped: body.stopped })
        .eq("id", id)
        .select("id,stopped,updated_at")
        .single();
      if (error || !data) return json(req, { ok: false, error: "Menu item not found" }, 404);
      return json(req, { ok: true, item: data });
    }

    if (action === "menu_delete_item") {
      if (!hasAnyRole(profile, EDIT_ROLES)) {
        return json(req, { ok: false, error: "Insufficient permissions" }, 403);
      }
      const id = parsePositiveId(body.id);
      if (!id) return json(req, { ok: false, error: "Invalid menu item" }, 400);
      const { error } = await serviceClient.from("menu_items").delete().eq("id", id);
      if (error) throw error;
      return json(req, { ok: true });
    }

    if (!hasAnyRole(profile, EDIT_ROLES)) {
      return json(req, { ok: false, error: "Insufficient permissions" }, 403);
    }
    const item = parseMenuInput(body);
    if (!item) return json(req, { ok: false, error: "Invalid menu item" }, 400);

    const payload = {
      section: item.section,
      category: item.category,
      name: item.name,
      price: item.price,
      weight: item.weight,
      description: item.description,
      photo: item.photo,
      allergens: item.allergens,
      cook_time_normal: item.cook_time_normal,
      cook_time_busy: item.cook_time_busy,
      emoji: item.emoji,
      stopped: item.stopped,
      sort_order: item.sort_order,
    };

    if (item.id) {
      const { data, error } = await serviceClient
        .from("menu_items")
        .update(payload)
        .eq("id", item.id)
        .select("id,section,category,name,price,weight,description,photo,allergens,cook_time_normal,cook_time_busy,emoji,stopped,sort_order,updated_at")
        .single();
      if (error) {
        if (error.code === "23505") return json(req, { ok: false, error: "Така позиція вже існує" }, 409);
        throw error;
      }
      return json(req, { ok: true, item: data });
    }

    let sortOrder = item.sort_order;
    if (sortOrder === 0) {
      const { data: last } = await serviceClient
        .from("menu_items")
        .select("sort_order")
        .eq("section", item.section)
        .eq("category", item.category)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      sortOrder = Number(last?.sort_order || 0) + 1;
    }

    const { data, error } = await serviceClient
      .from("menu_items")
      .insert({ ...payload, sort_order: sortOrder })
      .select("id,section,category,name,price,weight,description,photo,allergens,cook_time_normal,cook_time_busy,emoji,stopped,sort_order,updated_at")
      .single();
    if (error) {
      if (error.code === "23505") return json(req, { ok: false, error: "Така позиція вже існує" }, 409);
      throw error;
    }
    return json(req, { ok: true, item: data });
  } catch (error) {
    console.error("tiflis-menu-api failed", error);
    return json(req, { ok: false, error: "Operation failed" }, 502);
  }
});
