import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import './styles.css';

async function retireLegacyRuntime() {
  const marker = 'tiflis-v2-react-runtime-ready';
  if (localStorage.getItem(marker) === '1') return;

  const insecureKeys = [
    'tiflis2.session',
    'tiflis_session',
    'tiflis_saved_login',
    'tiflis_saved_password',
    'tiflis_tg_token',
  ];
  insecureKeys.forEach((key) => localStorage.removeItem(key));

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('tiflis-')).map((key) => caches.delete(key)));
  }

  localStorage.setItem(marker, '1');
}

void retireLegacyRuntime();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
