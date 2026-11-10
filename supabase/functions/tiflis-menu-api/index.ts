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
  "menu_upload_photo",
  "menu_progress_set",
]);
const STOP_ROLES = new Set(["admin", "sysadmin", "chef", "cook"]);
const EDIT_ROLES = new Set(["admin", "sysadmin", "chef"]);
const PHOTOS_BUCKET = "images";
const PHOTOS_PATH_PREFIX = "menu/";
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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
  explain: string | null;
  sell_line: string | null;
  pairing: string | null;
  learning_reviewed: boolean;
};

const ITEM_COLUMNS = "id,section,category,name,price,weight,description,photo,allergens,cook_time_normal,cook_time_busy,emoji,stopped,sort_order,updated_at,explain,sell_line,pairing,learning_reviewed";

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
  return ownedPhotoPath(photo) ? photo : "invalid";
}

// Only photos we uploaded count as "ours": same Supabase origin, the public menu/ folder, and an exact
// generated name (uuid.ext from menu_upload_photo, timestamp_random.ext from the older uploader).
// Anything else is rejected on save and never deleted from storage.
const OWNED_PHOTO_NAME = /^menu\/(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{10,16}_[a-z0-9]{4,20})\.(?:jpe?g|png|webp)$/;

function ownedPhotoPath(url: string | null): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.origin !== new URL(SUPABASE_URL).origin) return null;
  if (parsed.search || parsed.hash) return null;
  const prefix = `/storage/v1/object/public/${PHOTOS_BUCKET}/`;
  if (!parsed.pathname.startsWith(prefix)) return null;
  const path = parsed.pathname.slice(prefix.length);
  return OWNED_PHOTO_NAME.test(path) ? path : null;
}

function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function removePhotoIfUnused(
  client: ReturnType<typeof createServiceClient>,
  url: string | null,
): Promise<void> {
  const path = ownedPhotoPath(url);
  if (!path || !url) return;
  const { count } = await client.from("menu_items").select("id", { count: "exact", head: true }).eq("photo", url);
  if ((count ?? 0) === 0) await client.storage.from(PHOTOS_BUCKET).remove([path]);
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
    explain: cleanText(body.explain, 600) || null,
    sell_line: cleanText(body.sell_line, 600) || null,
    pairing: cleanText(body.pairing, 600) || null,
    learning_reviewed: body.learning_reviewed === true,
  };
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

  const serviceClient = createServiceClient();

  try {
    if (action === "menu_bootstrap") {
      const { data, error } = await serviceClient
        .from("menu_items")
        .select(ITEM_COLUMNS)
        .order("section", { ascending: true })
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;

      const { data: progress, error: progressError } = await serviceClient
        .from("menu_learning")
        .select("item_id,status")
        .eq("legacy_user_id", profile.legacy_user_id);
      if (progressError) throw progressError;

      return json(req, {
        ok: true,
        permissions: {
          canToggleStop: hasAnyRole(profile, STOP_ROLES),
          canEdit: hasAnyRole(profile, EDIT_ROLES),
        },
        items: data ?? [],
        progress: progress ?? [],
      });
    }

    if (action === "menu_progress_set") {
      // Every active staff member keeps their own learning progress.
      const id = parsePositiveId(body.id);
      const status = body.status;
      if (!id || (status !== "learning" && status !== "known" && status !== null)) {
        return json(req, { ok: false, error: "Некоректний прогрес" }, 400);
      }
      if (status === null) {
        const { error } = await serviceClient
          .from("menu_learning")
          .delete()
          .eq("legacy_user_id", profile.legacy_user_id)
          .eq("item_id", id);
        if (error) throw error;
        return json(req, { ok: true });
      }
      const { error } = await serviceClient
        .from("menu_learning")
        .upsert({ legacy_user_id: profile.legacy_user_id, item_id: id, status, updated_at: new Date().toISOString() });
      if (error) {
        if (error.code === "23503") return json(req, { ok: false, error: "Позицію не знайдено" }, 404);
        throw error;
      }
      return json(req, { ok: true });
    }

    if (action === "menu_toggle_stop") {
      if (!hasAnyRole(profile, STOP_ROLES)) {
        return json(req, { ok: false, error: "Недостатньо прав" }, 403);
      }
      const id = parsePositiveId(body.id);
      if (!id || typeof body.stopped !== "boolean") {
        return json(req, { ok: false, error: "Некоректна позиція" }, 400);
      }
      const { data, error } = await serviceClient
        .from("menu_items")
        .update({ stopped: body.stopped })
        .eq("id", id)
        .select("id,stopped,updated_at")
        .single();
      if (error || !data) return json(req, { ok: false, error: "Позицію не знайдено" }, 404);
      return json(req, { ok: true, item: data });
    }

    if (action === "menu_delete_item") {
      if (!hasAnyRole(profile, EDIT_ROLES)) {
        return json(req, { ok: false, error: "Недостатньо прав" }, 403);
      }
      const id = parsePositiveId(body.id);
      if (!id) return json(req, { ok: false, error: "Некоректна позиція" }, 400);
      const { data: existing } = await serviceClient
        .from("menu_items")
        .select("photo")
        .eq("id", id)
        .maybeSingle();
      const { error } = await serviceClient.from("menu_items").delete().eq("id", id);
      if (error) throw error;
      await removePhotoIfUnused(serviceClient, existing?.photo ?? null);
      return json(req, { ok: true });
    }

    if (action === "menu_upload_photo") {
      if (!hasAnyRole(profile, EDIT_ROLES)) {
        return json(req, { ok: false, error: "Недостатньо прав" }, 403);
      }
      const contentType = cleanText(body.content_type, 40);
      const extension = PHOTO_EXTENSIONS[contentType];
      const rawData = cleanText(body.data, 12_000_000);
      if (!extension || !rawData) {
        return json(req, { ok: false, error: "Непідтримуваний формат фото" }, 400);
      }

      const base64 = rawData.includes(",") ? rawData.slice(rawData.indexOf(",") + 1) : rawData;
      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      } catch {
        return json(req, { ok: false, error: "Некоректні дані фото" }, 400);
      }
      if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) {
        return json(req, { ok: false, error: "Фото завелике (максимум 6 МБ)" }, 400);
      }

      const path = `${PHOTOS_PATH_PREFIX}${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await serviceClient.storage
        .from(PHOTOS_BUCKET)
        .upload(path, bytes, { contentType, upsert: false });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = serviceClient.storage.from(PHOTOS_BUCKET).getPublicUrl(path);
      return json(req, { ok: true, photo: publicUrlData.publicUrl });
    }

    if (!hasAnyRole(profile, EDIT_ROLES)) {
      return json(req, { ok: false, error: "Недостатньо прав" }, 403);
    }
    // An edit that keeps the item's current photo must save even if that photo predates the owned-URL rule.
    const editId = parsePositiveId(body.id);
    let keptPhoto: string | null = null;
    if (editId && typeof body.photo === "string" && body.photo) {
      const { data: current } = await serviceClient.from("menu_items").select("photo").eq("id", editId).maybeSingle();
      if (current?.photo && current.photo === body.photo) keptPhoto = current.photo;
    }
    const item = parseMenuInput(keptPhoto ? { ...body, photo: "" } : body);
    if (!item) return json(req, { ok: false, error: "Перевір назву, категорію, ціну, час і фото" }, 400);
    if (keptPhoto) item.photo = keptPhoto;

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
      explain: item.explain,
      sell_line: item.sell_line,
      pairing: item.pairing,
      learning_reviewed: item.learning_reviewed,
    };

    if (item.id) {
      const { data: existing } = await serviceClient
        .from("menu_items")
        .select("photo")
        .eq("id", item.id)
        .maybeSingle();
      const { data, error } = await serviceClient
        .from("menu_items")
        .update(payload)
        .eq("id", item.id)
        .select(ITEM_COLUMNS)
        .single();
      if (error) {
        if (error.code === "23505") return json(req, { ok: false, error: "Така позиція вже існує" }, 409);
        throw error;
      }
      if (existing?.photo && existing.photo !== item.photo) {
        await removePhotoIfUnused(serviceClient, existing.photo);
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
      .select(ITEM_COLUMNS)
      .single();
    if (error) {
      if (error.code === "23505") return json(req, { ok: false, error: "Така позиція вже існує" }, 409);
      throw error;
    }
    return json(req, { ok: true, item: data });
  } catch (error) {
    console.error("tiflis-menu-api failed", error);
    return json(req, { ok: false, error: "Не вдалося виконати дію, спробуй ще раз" }, 502);
  }
});
