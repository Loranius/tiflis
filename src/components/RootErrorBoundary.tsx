import { Component, type ErrorInfo, type ReactNode } from 'react';

interface RootErrorBoundaryProps {
  children: ReactNode;
}

interface RootErrorBoundaryState {
  error: Error | null;
  recovering: boolean;
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

async function clearPortalRuntime(): Promise<void> {
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

export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = {
    error: null,
    recovering: false,
  };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error, recovering: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Tiflis] Unhandled application error', error, info.componentStack);
  }

  private recover = () => {
    if (this.state.recovering) return;
    this.setState({ recovering: true });

    void clearPortalRuntime().finally(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('recover', Date.now().toString());
      window.location.replace(url.toString());
    });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#101813',
        color: '#f2eee5',
        fontFamily: 'Manrope, system-ui, sans-serif',
      }}>
        <section style={{
          width: 'min(100%, 460px)',
          display: 'grid',
          gap: 14,
          padding: 26,
          border: '1px solid rgba(215,182,108,.28)',
          borderRadius: 24,
          background: '#17231b',
          boxShadow: '0 28px 80px rgba(0,0,0,.38)',
          textAlign: 'center',
        }}>
          <span style={{ color: '#d7b66c', fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' }}>
            Захищене відновлення
          </span>
          <h1 style={{ margin: 0, color: '#f4d98e', fontFamily: 'Prata, serif', fontSize: 30, fontWeight: 400 }}>
            Розділ не завантажився
          </h1>
          <p style={{ margin: 0, color: '#b8c1ba', lineHeight: 1.65 }}>
            Портал не залишить вас на чорному екрані. Перезапустіть робочу версію — застарілий кеш Тифлісу буде очищено автоматично.
          </p>
          <button
            type="button"
            onClick={this.recover}
            disabled={this.state.recovering}
            style={{
              minHeight: 48,
              marginTop: 4,
              border: '1px solid rgba(215,182,108,.34)',
              borderRadius: 14,
              background: 'linear-gradient(135deg,#d7b66c,#b99045)',
              color: '#17150f',
              font: 'inherit',
              fontWeight: 850,
              cursor: this.state.recovering ? 'wait' : 'pointer',
              opacity: this.state.recovering ? .72 : 1,
            }}
          >
            {this.state.recovering ? 'Відновлюємо…' : 'Перезапустити портал'}
          </button>
        </section>
      </main>
    );
  }
}
