import { edgeFunctionUrl, supabase, supabasePublishableKey } from './supabase';

interface SecureApiEnvelope {
  ok: boolean;
  error?: string;
}

interface SecureApiOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  dedupe?: boolean;
  cacheTtlMs?: number;
  forceRefresh?: boolean;
  invalidateCache?: boolean;
}

interface ResponseCacheEntry {
  expiresAt: number;
  domain: string;
  generation: number;
  value: SecureApiEnvelope;
}

const DEFAULT_BOOTSTRAP_CACHE_TTL_MS = 15_000;
const DEFAULT_READ_CACHE_TTL_MS = 5_000;
const MAX_RESPONSE_CACHE_ENTRIES = 24;
const inFlightRequests = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, ResponseCacheEntry>();
const cacheGenerations = new Map<string, number>();
let accessTokenRequest: Promise<string> | null = null;

/* ---------- last known responses (stale-while-revalidate) ----------
   Every successful read is remembered in memory, keyed by function and body.
   A screen opened again paints this copy at once and refreshes it in the
   background, instead of waiting 0.5–1.3 s for the edge function. The store
   lives only in this tab's memory and belongs to one account: it is cleared
   when a token for another user appears, and on sign-out. */
const LAST_KNOWN_LIMIT = 40;
const lastKnown = new Map<string, { domain: string; value: SecureApiEnvelope }>();
// The signed-in auth user the store belongs to (set by AuthProvider), and an
// epoch bumped on every clear: a reply that started before a sign-out or an
// account switch is dropped instead of landing in the new account's memory.
let activeOwner = '';
let memoryEpoch = 0;

function tokenSubject(token: string): string {
  try {
    const payload = token.split('.')[1] || '';
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: string };
    return json.sub || '';
  } catch {
    return '';
  }
}

function lastKnownKey(functionSlug: string, body: Record<string, unknown>): string {
  return `${functionSlug}:${JSON.stringify(body)}`;
}

function rememberLastKnown(epoch: number, token: string, functionSlug: string, body: Record<string, unknown>, domain: string, value: SecureApiEnvelope) {
  if (epoch !== memoryEpoch || !activeOwner || tokenSubject(token) !== activeOwner) return;
  const key = lastKnownKey(functionSlug, body);
  lastKnown.delete(key);
  lastKnown.set(key, { domain, value });
  while (lastKnown.size > LAST_KNOWN_LIMIT) {
    const oldest = lastKnown.keys().next().value as string | undefined;
    if (!oldest) break;
    lastKnown.delete(oldest);
  }
}

/** The last successful response for exactly this request, or null. Synchronous:
    use it as a screen's initial state, then call secureApi to refresh. */
export function peekSecureApi<T extends SecureApiEnvelope>(
  body: Record<string, unknown>,
  functionSlug = 'tiflis-secure-api',
): T | null {
  const action = typeof body.action === 'string' ? body.action : '';
  const slug = functionSlug === 'tiflis-secure-api' && action === 'cash_bootstrap' ? 'tiflis-cash-anonymous-api' : functionSlug;
  if (!activeOwner) return null;
  return (lastKnown.get(lastKnownKey(slug, body))?.value as T | undefined) ?? null;
}

/** Forget every remembered response (sign-out, account switch). */
export function clearSecureApiMemory() {
  memoryEpoch += 1;
  lastKnown.clear();
  activeOwner = '';
  responseCache.clear();
  inFlightRequests.clear();
}

/** Bind the memory to the signed-in auth user; another user (or none) clears it. */
export function setSecureApiOwner(authUserId: string | null) {
  const next = authUserId || '';
  if (next === activeOwner) return;
  clearSecureApiMemory();
  activeOwner = next;
}
let refreshTokenRequest: Promise<string> | null = null;

function cacheDomain(action: string, functionSlug: string): string {
  if (action.startsWith('today_cash_') || action.startsWith('cash_')) return 'cash';
  if (action.startsWith('schedule_')) return 'schedule';
  if (action.startsWith('menu_')) return 'menu';
  if (action.startsWith('records_')) return 'records';
  if (action.startsWith('planner_')) return 'duties';
  if (action.startsWith('today_reservations_') || action.startsWith('reserve_')) return 'reserve';
  if (action.startsWith('staff_')) return 'staff';
  if (action.startsWith('admin_')) return 'admin';
  return functionSlug;
}

function domainGeneration(domain: string): number {
  return cacheGenerations.get(domain) || 0;
}

function requestKey(
  functionSlug: string,
  body: Record<string, unknown>,
  token: string,
  generation: number,
): string {
  const sessionFingerprint = token.slice(-18);
  return `${sessionFingerprint}:${generation}:${functionSlug}:${JSON.stringify(body)}`;
}

function invalidateResponseCache(domain: string) {
  cacheGenerations.set(domain, domainGeneration(domain) + 1);
  // After a write the remembered copy is wrong; the next visit waits for fresh data.
  for (const [key, entry] of lastKnown) {
    if (entry.domain === domain) lastKnown.delete(key);
  }
  for (const [key, entry] of responseCache) {
    if (entry.domain === domain) responseCache.delete(key);
  }
}

function pruneResponseCache(now = Date.now()) {
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now || entry.generation !== domainGeneration(entry.domain)) {
      responseCache.delete(key);
    }
  }

  while (responseCache.size > MAX_RESPONSE_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    responseCache.delete(oldestKey);
  }
}

function rememberResponse(
  key: string,
  value: SecureApiEnvelope,
  ttlMs: number,
  domain: string,
  generation: number,
) {
  if (ttlMs <= 0 || generation !== domainGeneration(domain)) return;
  responseCache.delete(key);
  responseCache.set(key, {
    expiresAt: Date.now() + ttlMs,
    domain,
    generation,
    value,
  });
  pruneResponseCache();
}

async function getAccessToken(): Promise<string> {
  if (accessTokenRequest) return accessTokenRequest;

  const request = supabase.auth.getSession().then(({ data, error }) => {
    if (error || !data.session?.access_token) {
      throw new Error('Сесія завершилась. Увійдіть повторно.');
    }
    return data.session.access_token;
  });

  accessTokenRequest = request;
  void request.then(
    () => { accessTokenRequest = null; },
    () => { accessTokenRequest = null; },
  );
  return request;
}

async function refreshAccessToken(): Promise<string> {
  if (refreshTokenRequest) return refreshTokenRequest;

  const request = supabase.auth.refreshSession().then(({ data, error }) => {
    if (error || !data.session?.access_token) {
      throw new Error('Сесія завершилась. Увійдіть повторно.');
    }
    return data.session.access_token;
  });

  refreshTokenRequest = request;
  void request.then(
    () => { refreshTokenRequest = null; },
    () => { refreshTokenRequest = null; },
  );
  return request;
}

function isReadAction(action: string): boolean {
  return action.endsWith('_bootstrap') || action.endsWith('_get');
}

async function executeSecureApi<T extends SecureApiEnvelope>(
  body: Record<string, unknown>,
  functionSlug: string,
  options: SecureApiOptions,
  initialToken: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
  const abortFromCaller = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true });

  const post = (token: string) => fetch(edgeFunctionUrl(functionSlug), {
    method: 'POST',
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  try {
    let response = await post(initialToken);

    if (response.status === 401 && !controller.signal.aborted) {
      response = await post(await refreshAccessToken());
    }

    let payload: T;
    try {
      payload = (await response.json()) as T;
    } catch {
      throw new Error('Сервер повернув некоректну відповідь.');
    }

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Не вдалося виконати операцію.');
    }

    return payload;
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') {
      throw new Error('Сервер відповідає надто довго. Спробуйте ще раз.');
    }
    throw reason;
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export async function secureApi<T extends SecureApiEnvelope>(
  body: Record<string, unknown>,
  functionSlug = 'tiflis-secure-api',
  options: SecureApiOptions = {},
): Promise<T> {
  const action = typeof body.action === 'string' ? body.action : '';
  const isBootstrap = action.endsWith('_bootstrap');
  const isRead = isReadAction(action);
  const resolvedFunctionSlug = functionSlug === 'tiflis-secure-api' && action === 'cash_bootstrap'
    ? 'tiflis-cash-anonymous-api'
    : functionSlug;
  const domain = cacheDomain(action, resolvedFunctionSlug);
  const epoch = memoryEpoch;

  if (options.invalidateCache ?? !isRead) {
    invalidateResponseCache(domain);
    // Records are derived from cash and schedule, so a new entry must show up there at once.
    if (domain === 'cash' || domain === 'schedule') invalidateResponseCache('records');
  }

  const token = await getAccessToken();
  const generation = domainGeneration(domain);
  const key = requestKey(resolvedFunctionSlug, body, token, generation);
  const cacheTtlMs = isRead
    ? Math.max(0, options.cacheTtlMs ?? (isBootstrap ? DEFAULT_BOOTSTRAP_CACHE_TTL_MS : DEFAULT_READ_CACHE_TTL_MS))
    : 0;
  const shouldCache = cacheTtlMs > 0 && !options.signal;
  const shouldDedupe = options.forceRefresh ? false : (options.dedupe ?? isRead);

  if (shouldCache && !options.forceRefresh) {
    pruneResponseCache();
    const cached = responseCache.get(key);
    if (
      cached
      && cached.expiresAt > Date.now()
      && cached.domain === domain
      && cached.generation === generation
    ) {
      responseCache.delete(key);
      responseCache.set(key, cached);
      return cached.value as T;
    }
  }

  if (!shouldDedupe || options.signal) {
    const payload = await executeSecureApi<T>(body, resolvedFunctionSlug, options, token);
    if (shouldCache) rememberResponse(key, payload, cacheTtlMs, domain, generation);
    if (isRead) rememberLastKnown(epoch, token, resolvedFunctionSlug, body, domain, payload);
    return payload;
  }

  const existing = inFlightRequests.get(key);
  if (existing) return existing as Promise<T>;

  const request = executeSecureApi<T>(body, resolvedFunctionSlug, options, token);
  inFlightRequests.set(key, request);
  void request.then(
    (payload) => {
      if (inFlightRequests.get(key) === request) inFlightRequests.delete(key);
      if (shouldCache) rememberResponse(key, payload, cacheTtlMs, domain, generation);
      if (isRead) rememberLastKnown(epoch, token, resolvedFunctionSlug, body, domain, payload);
    },
    () => {
      if (inFlightRequests.get(key) === request) inFlightRequests.delete(key);
    },
  );
  return request;
}
