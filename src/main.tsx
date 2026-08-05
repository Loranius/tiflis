import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import { ModalRuntime } from './components/ModalRuntime';
import { RootErrorBoundary } from './components/RootErrorBoundary';
import './styles.css';
import './performance.css';
import './design-system.css';
import './route-transitions.css';
import './legacy-navigation.css';
import './reserve-mobile.css';
import './modal-runtime.css';
import './mobile-operations-fixes.css';
import './mobile-operations-critical.css';
import './mobile-density.css';
import './ux-cleanup-20260805.css';

const BUILD_ID = import.meta.env.VITE_BUILD_ID || 'development';
const RUNTIME_VERSION_KEY = 'tiflis.runtime.version';

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

function isPortalWorker(registration: ServiceWorkerRegistration): boolean {
  const scriptUrl = registration.active?.scriptURL
    || registration.waiting?.scriptURL
    || registration.installing?.scriptURL
    || '';
  if (!scriptUrl) return false;

  const expected = new URL('./sw.js', document.baseURI).href;
  return scriptUrl === expected || new URL(scriptUrl).pathname.endsWith('/tiflis/sw.js');
}

async function retireLegacyRuntime() {
  const jobs: Promise<unknown>[] = [];

  if ('serviceWorker' in navigator) {
    jobs.push(
      navigator.serviceWorker.getRegistrations().then((registrations) => Promise.allSettled(
        registrations.filter(isPortalWorker).map((registration) => registration.unregister()),
      )),
    );
  }

  if ('caches' in window) {
    jobs.push(
      caches.keys().then((keys) => Promise.allSettled(
        keys.filter((key) => key.toLowerCase().startsWith('tiflis')).map((key) => caches.delete(key)),
      )),
    );
  }

  await Promise.allSettled(jobs);
}

function scheduleRuntimeRetirement() {
  if (safeStorageGet(RUNTIME_VERSION_KEY) === BUILD_ID) return;

  const finish = async () => {
    await retireLegacyRuntime();
    safeStorageSet(RUNTIME_VERSION_KEY, BUILD_ID);
  };

  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  };

  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(() => { void finish(); }, { timeout: 1200 });
  } else {
    window.setTimeout(() => { void finish(); }, 300);
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
    <RootErrorBoundary>
      <ModalRuntime />
      <AuthProvider>
        <App />
      </AuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);

window.requestAnimationFrame(reportStarted);
scheduleRuntimeRetirement();
