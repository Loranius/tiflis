import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import './styles.css';
import './performance.css';
import './design-system.css';
import './route-transitions.css';
import './legacy-navigation.css';
import './reserve-mobile.css';

const LEGACY_MARKER = 'tiflis-v2-react-runtime-ready-20260805-1';

function safeStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked by privacy settings. The portal must still start.
  }
}

function clearInsecureLegacyStorage() {
  const insecureKeys = [
    'tiflis2.session',
    'tiflis_session',
    'tiflis_saved_login',
    'tiflis_saved_password',
    'tiflis_tg_token',
  ];

  try {
    insecureKeys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // A denied localStorage access must not turn the whole application black.
  }
}

async function unregisterLegacyWorkers() {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(registrations.map((registration) => registration.unregister()));
}

async function clearLegacyCaches() {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.allSettled(keys.map((key) => caches.delete(key)));
}

function scheduleLegacyRetirement() {
  if (safeStorageGet(LEGACY_MARKER) === '1') return;

  const finish = async () => {
    await Promise.allSettled([unregisterLegacyWorkers(), clearLegacyCaches()]);
    safeStorageSet(LEGACY_MARKER, '1');
  };

  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  };

  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(() => { void finish(); }, { timeout: 1500 });
  } else {
    window.setTimeout(() => { void finish(); }, 400);
  }
}

function reportStarted() {
  const recoveryWindow = window as Window & {
    __TIFLIS_APP_STARTED__?: () => void;
  };
  recoveryWindow.__TIFLIS_APP_STARTED__?.();
}

clearInsecureLegacyStorage();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);

window.requestAnimationFrame(reportStarted);
scheduleLegacyRetirement();
