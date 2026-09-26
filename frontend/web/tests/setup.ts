import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { i18n, initI18n } from '@/i18n';
import { server } from '@/mocks/node';

initI18n();

// MSW: requests no handler answers fail the test instead of reaching the network
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Every test starts in Vietnamese, whatever a previous test switched to.
beforeEach(async () => {
  if (i18n.language !== 'vi') {
    await i18n.changeLanguage('vi');
  }
});
