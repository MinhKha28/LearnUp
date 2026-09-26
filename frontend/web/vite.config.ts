import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, URL } from 'node:url';

/**
 * Serves MSW's service worker at /mockServiceWorker.js in dev only (apply: 'serve'), straight
 * from the installed msw package: nothing is copied to public/, so no mock code reaches dist/.
 */
const mswWorker = (): Plugin => ({
  name: 'learnup:msw-worker',
  apply: 'serve',
  configureServer(server) {
    const workerPath = createRequire(import.meta.url).resolve('msw/mockServiceWorker.js');
    server.middlewares.use('/mockServiceWorker.js', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript');
      createReadStream(workerPath).pipe(res);
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), mswWorker()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
