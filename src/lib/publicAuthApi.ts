import { edgeFunctionUrl, supabasePublishableKey } from './supabase';

interface PublicAuthResponse {
  ok: boolean;
  message?: string;
  error?: string;
  status?: string;
}

async function request(body: Record<string, unknown>): Promise<PublicAuthResponse> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(edgeFunctionUrl('tiflis-registration-api'), {
      method: 'POST',
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${supabasePublishableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as PublicAuthResponse | null;
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Операцію не виконано.');
    return payload;
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') {
      throw new Error('Сервер відповідає надто довго. Спробуйте ще раз.');
    }
    throw reason;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function registerPortalUser(input: {
  login: string;
  password: string;
  passwordConfirm: string;
}) {
  return request({
    action: 'register',
    display_name: input.login,
    login: input.login,
    password: input.password,
    password_confirm: input.passwordConfirm,
  });
}

export function requestPasswordReset(login: string) {
  return request({ action: 'reset_request', login });
}

export function confirmPasswordReset(input: {
  login: string;
  code: string;
  password: string;
  passwordConfirm: string;
}) {
  return request({
    action: 'reset_confirm',
    login: input.login,
    code: input.code,
    password: input.password,
    password_confirm: input.passwordConfirm,
  });
}
