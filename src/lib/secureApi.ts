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
}

interface ResponseCacheEntry {
  expiresAt: number;
  generation: number;
  value: SecureApiEnvelope;
}

const DEFAULT_BOOTSTRAP_CACHE_TTL_MS = 15_000;
const MAX_RESPONSE_CACHE_ENTRIES = 24;
const inFlightRequests = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, ResponseCacheEntry>();
let accessTokenRequest: Promise<string> | null = null;
let cacheGeneration = 0;

function requestKey(functionSlug: string, body: Record<string, unknown>, token: string): string {
  const sessionFingerprint = token.slice(-18);
  return `${sessionFingerprint}:${functionSlug}:${JSON.stringify(body)}`;
}

function invalidateResponseCache() {
  cacheGeneration += 1;
  responseCache.clear();
  inFlightRequests.clear();
}

function pruneResponseCache(now = Date.now()) {
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now || entry.generation !== cacheGeneration) {
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
  generation: number,
) {
  if (ttlMs <= 0 || generation !== cacheGeneration) return;
  responseCache.delete(key);
  responseCache.set(key, {
    expiresAt: Date.now() + ttlMs,
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

async function executeSecureApi<T extends SecureApiEnvelope>(
  body: Record<string, unknown>,
  functionSlug: string,
  options: SecureApiOptions,
  initialToken: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });

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
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session?.access_token) {
        throw new Error('Сесія завершилась. Увійдіть повторно.');
      }
      response = await post(data.session.access_token);
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
  const resolvedFunctionSlug = functionSlug === 'tiflis-secure-api' && action === 'cash_bootstrap'
    ? 'tiflis-cash-anonymous-api'
    : functionSlug;

  if (!isBootstrap) invalidateResponseCache();

  const token = await getAccessToken();
  const key = requestKey(resolvedFunctionSlug, body, token);
  const cacheTtlMs = isBootstrap
    ? Math.max(0, options.cacheTtlMs ?? DEFAULT_BOOTSTRAP_CACHE_TTL_MS)
    : 0;
  const shouldCache = cacheTtlMs > 0 && !options.signal;
  const shouldDedupe = options.dedupe ?? isBootstrap;

  if (shouldCache && !options.forceRefresh) {
    pruneResponseCache();
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now() && cached.generation === cacheGeneration) {
      responseCache.delete(key);
      responseCache.set(key, cached);
      return cached.value as T;
    }
  }

  if (!shouldDedupe || options.signal) {
    const generation = cacheGeneration;
    const payload = await executeSecureApi<T>(body, resolvedFunctionSlug, options, token);
    if (shouldCache) rememberResponse(key, payload, cacheTtlMs, generation);
    return payload;
  }

  const existing = inFlightRequests.get(key);
  if (existing) return existing as Promise<T>;

  const generation = cacheGeneration;
  const request = executeSecureApi<T>(body, resolvedFunctionSlug, options, token);
  inFlightRequests.set(key, request);
  void request.then(
    (payload) => {
      if (inFlightRequests.get(key) === request) inFlightRequests.delete(key);
      if (shouldCache) rememberResponse(key, payload, cacheTtlMs, generation);
    },
    () => {
      if (inFlightRequests.get(key) === request) inFlightRequests.delete(key);
    },
  );
  return request;
}
