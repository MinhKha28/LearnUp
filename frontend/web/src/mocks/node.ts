import { setupServer } from 'msw/node';
import { defaultHandlers } from './handlers';

/**
 * MSW for Vitest (tests/setup.ts). Starts with the default handlers; a test adds others with
 * server.use(...optionalHandlers.auth) or its own handlers, and they are reset after each test.
 */
export const server = setupServer(...defaultHandlers);
