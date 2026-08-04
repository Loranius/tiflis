import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://duzfttrrzeqvxpfnyxfg.supabase.co';
const FALLBACK_PUBLISHABLE_KEY = 'sb_publishable_ICnIrODW2ZMbbhia8iBoCA_vCgQwoPx';

export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL).trim();
export const supabasePublishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_PUBLISHABLE_KEY
).trim();

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'tiflis-v2-auth',
  },
});

export function edgeFunctionUrl(slug: string): string {
  return `${supabaseUrl}/functions/v1/${slug}`;
}
