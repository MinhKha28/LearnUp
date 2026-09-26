import { setupWorker } from 'msw/browser';
import { getHandlers, parseMockGroups } from './handlers';

/**
 * Starts the MSW service worker. Only imported from main.tsx behind
 * import.meta.env.DEV && VITE_USE_MOCKS === 'true', so it never reaches a production build.
 * /mockServiceWorker.js is served by the dev-only plugin in vite.config.ts.
 */
export const startMockWorker = async (): Promise<void> => {
  const groups = parseMockGroups(import.meta.env.VITE_MOCKS_INCLUDE);
  const worker = setupWorker(...getHandlers(groups));
  // Requests without a handler (e.g. the real backend) go to the network untouched
  await worker.start({ onUnhandledRequest: 'bypass' });
  console.info(
    `[mocks] MSW on — default handlers${groups.length ? ` + ${groups.join(', ')}` : ''}`
  );
};
