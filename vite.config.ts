import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const RAW_RUNTIME_PATTERN = /\s*<!-- TIFLIS_RAW_RUNTIME_START -->[\s\S]*?<!-- TIFLIS_RAW_RUNTIME_END -->\s*/;
const VITE_ENTRY_MARKER = '<!-- TIFLIS_VITE_ENTRY -->';

function portalEntryPlugin(): Plugin {
  return {
    name: 'tiflis-portal-entry',
    enforce: 'pre',
    transformIndexHtml(html) {
      if (!html.includes(VITE_ENTRY_MARKER)) {
        throw new Error('Tiflis Vite entry marker is missing from index.html');
      }

      return html
        .replace(RAW_RUNTIME_PATTERN, '\n')
        .replace(VITE_ENTRY_MARKER, '<script type="module" src="/src/main.tsx"></script>');
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [portalEntryPlugin(), react()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
