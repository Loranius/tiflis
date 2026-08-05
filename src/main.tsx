import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import './styles.css';
import './performance.css';
import './design-system.css';
import './route-transitions.css';

const LEGACY_MARKER = 'tiflis-v2-react-runtime-ready';

function clearInsecureLegacyStorage() {
  const insecureKeys = [
    'tiflis2.session',
    'tiflis_session',
    'tiflis_saved_login',
    'tiflis_saved_password',
    'tiflis_tg_token',
  ];
  insecureKeys.forEach((key) => localStorage.removeItem(key));
}

async function unregisterLegacyWorkers() {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(registrations.map((registration) => registration.unregister()));
}

async function clearLegacyCaches() {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.allSettled(
    keys.filter((key) => key.startsWith('tiflis-')).map((key) => caches.delete(key)),
  );
}

function scheduleLegacyRetirement() {
  if (localStorage.getItem(LEGACY_MARKER) === '1') return;

  const finish = async () => {
    await Promise.allSettled([unregisterLegacyWorkers(), clearLegacyCaches()]);
    localStorage.setItem(LEGACY_MARKER, '1');
  };

  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  };

  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(() => { void finish(); }, { timeout: 2500 });
  } else {
    window.setTimeout(() => { void finish(); }, 900);
  }
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

scheduleLegacyRetirement();
