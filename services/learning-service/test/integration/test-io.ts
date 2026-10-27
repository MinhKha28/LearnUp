import { Client, type ClientConfig } from 'pg';
import { IO_TIMEOUT_MS } from './deadlines';

export class TestClient extends Client {
  constructor(config: ClientConfig) {
    super({
      ...config,
      statement_timeout: IO_TIMEOUT_MS,
      connectionTimeoutMillis: IO_TIMEOUT_MS,
    });
  }
}

export const testFetch: typeof globalThis.fetch = (input, init) => {
  const configured = Number(process.env.COURSE_SERVICE_TIMEOUT_MS);
  if (!Number.isSafeInteger(configured) || configured <= 0)
    throw new Error(
      'Harness HTTP requires configured COURSE_SERVICE_TIMEOUT_MS',
    );
  const timeout = AbortSignal.timeout(configured);
  return globalThis.fetch(input, {
    ...init,
    signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
  });
};
