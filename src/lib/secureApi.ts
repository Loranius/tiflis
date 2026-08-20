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

  if (options.invalidateCache ?? !isRead) invalidateResponseCache(domain);

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
    },
    () => {
      if (inFlightRequests.get(key) === request) inFlightRequests.delete(key);
    },
  );
  return request;
}
