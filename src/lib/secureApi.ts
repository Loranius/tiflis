import { edgeFunctionUrl, supabase, supabasePublishableKey } from './supabase';

interface SecureApiEnvelope {
  ok: boolean;
  error?: string;
}

interface SecureApiOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  dedupe?: boolean;
}

const inFlightRequests = new Map<string, Promise<unknown>>();
let accessTokenRequest: Promise<string> | null = null;

function requestKey(functionSlug: string, body: Record<string, unknown>): string {
  return `${functionSlug}:${JSON.stringify(body)}`;
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
    let response = await post(await getAccessToken());

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

export function secureApi<T extends SecureApiEnvelope>(
  body: Record<string, unknown>,
  functionSlug = 'tiflis-secure-api',
  options: SecureApiOptions = {},
): Promise<T> {
  const action = typeof body.action === 'string' ? body.action : '';
  const shouldDedupe = options.dedupe ?? action.endsWith('_bootstrap');

  if (!shouldDedupe || options.signal) {
    return executeSecureApi<T>(body, functionSlug, options);
  }

  const key = requestKey(functionSlug, body);
  const existing = inFlightRequests.get(key);
  if (existing) return existing as Promise<T>;

  const request = executeSecureApi<T>(body, functionSlug, options);
  inFlightRequests.set(key, request);
  void request.then(
    () => inFlightRequests.delete(key),
    () => inFlightRequests.delete(key),
  );
  return request;
}
