import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const RAW_RUNTIME_PATTERN = /\s*<!-- TIFLIS_RAW_RUNTIME_START -->[\s\S]*?<!-- TIFLIS_RAW_RUNTIME_END -->\s*/;
const VITE_ENTRY_MARKER = '<!-- TIFLIS_VITE_ENTRY -->';
const BUILD_ID_MARKER = '__TIFLIS_BUILD_ID__';

function normalizeBuildId(value: string | undefined): string {
  const normalized = value?.trim().replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 96);
  return normalized || 'local-dev';
}

function portalEntryPlugin(buildId: string): Plugin {
  return {
    name: 'tiflis-portal-entry',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!html.includes(VITE_ENTRY_MARKER)) {
          throw new Error('Tiflis Vite entry marker is missing from index.html');
        }
        if (!html.includes(BUILD_ID_MARKER)) {
          throw new Error('Tiflis build identifier marker is missing from index.html');
        }

        return html
          .replace(BUILD_ID_MARKER, buildId)
          .replace(RAW_RUNTIME_PATTERN, '\n')
          .replace(VITE_ENTRY_MARKER, '<script type="module" src="/src/main.tsx"></script>');
      },
    },
  };
}

function portalVendorChunk(id: string): string | undefined {
  if (id.includes('/node_modules/@supabase/')) return 'supabase-vendor';
  if (
    id.includes('/node_modules/react/')
    || id.includes('/node_modules/react-dom/')
    || id.includes('/node_modules/react-router/')
    || id.includes('/node_modules/scheduler/')
  ) return 'react-vendor';
  if (id.includes('/node_modules/lucide-react/')) return 'icons-vendor';
  return undefined;
}

export default defineConfig(({ mode }) => {
  const buildId = normalizeBuildId(loadEnv(mode, '.', '').VITE_BUILD_ID);

  return {
    base: './',
    define: {
      'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
    },
    plugins: [portalEntryPlugin(buildId), react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: portalVendorChunk,
        },
      },
    },
    server: {
      host: true,
      port: 5173,
    },
    preview: {
      host: true,
      port: 4173,
    },
  };
});
