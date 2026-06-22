// ╔═══════════════════════════════════════════════════════════════╗
// ║  [14/14] СТАРТ (ініціалізація при завантаженні)               ║
// ╚═══════════════════════════════════════════════════════════════╝

// Enter для логіну
document.addEventListener('keydown', e => {
  if (e.key==='Enter' && document.getElementById('login-screen')) App.login();
});

// Одразу синхронізувати при поверненні на вкладку
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && currentUser) {
    App._poll();
  }
});

// Спробувати відновити сесію при завантаженні
(async () => {
  // Застосувати збережену тему оформлення якнайшвидше
  Theme.init();

  // Відновити індикатор відкладених офлайн-операцій
  App._updateOfflineQueueBadge(sb._getQueue().length);

  // Реагувати на зміну стану мережі браузера
  window.addEventListener('online', () => { sb.flushQueue().catch(()=>{}); });
  window.addEventListener('offline', () => { sb._setOffline(true); });

  // Показати лоадер
  const ls = $('login-screen');
  if (ls) {
    const loader = document.createElement('div');
    loader.id = 'session-loader';
    loader.style.cssText = 'position:fixed;inset:0;background:var(--eden-dark);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px';
    loader.innerHTML = `
      <div style="font-family:'Cormorant Garamond',serif;font-size:36px;color:var(--gold);letter-spacing:.15em;font-weight:700">ТИФЛІС</div>
      <div style="width:40px;height:40px;border:3px solid var(--gold-border);border-top-color:var(--gold);border-radius:50%;animation:spin .8s linear infinite"></div>`;
    document.body.appendChild(loader);
  }

  const restored = await App.restoreSession();

  // Прибрати лоадер
  const loader = document.getElementById('session-loader');
  if (loader) loader.remove();
})();

// ── PWA: реєстрація Service Worker ─────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}


