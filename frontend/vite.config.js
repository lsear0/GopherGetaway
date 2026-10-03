import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development the frontend runs on :5173 and proxies /api to the backend
// on :3001, so the browser only ever talks to the Vite dev server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
