import { edgeFunctionUrl, supabase, supabasePublishableKey } from './supabase';

interface SecureApiEnvelope {
  ok: boolean;
  error?: string;
}

export async function secureApi<T extends SecureApiEnvelope>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !data.session?.access_token) {
    throw new Error('Сесія завершилась. Увійдіть повторно.');
  }

  const response = await fetch(edgeFunctionUrl('tiflis-secure-api'), {
    method: 'POST',
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${data.session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

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
}
