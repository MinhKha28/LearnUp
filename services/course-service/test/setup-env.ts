// Synthetic configuration for disposable integration tests only.
const TEST_INTERNAL_SERVICE_KEY = 'ctest1-synthetic-internal-test-key';
const TEST_NODE_ENV = 'test';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing integration test configuration in production.');
}
process.env.NODE_ENV ??= TEST_NODE_ENV;
process.env.INTERNAL_SERVICE_KEY ??= TEST_INTERNAL_SERVICE_KEY;
process.env.OUTBOX_RELAY_ENABLED ??= 'false';

export {};
