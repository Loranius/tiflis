import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const RAW_RUNTIME_PATTERN = /\s*<!-- TIFLIS_RAW_RUNTIME_START -->[\s\S]*?<!-- TIFLIS_RAW_RUNTIME_END -->\s*/;
const VITE_ENTRY_MARKER = '<!-- TIFLIS_VITE_ENTRY -->';

function portalEntryPlugin(): Plugin {
  return {
    name: 'tiflis-portal-entry',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!html.includes(VITE_ENTRY_MARKER)) {
          throw new Error('Tiflis Vite entry marker is missing from index.html');
        }

        return html
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
  return undefined;
}

export default defineConfig({
  base: './',
  plugins: [portalEntryPlugin(), react()],
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
});
