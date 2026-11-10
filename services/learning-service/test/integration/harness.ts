import { after, beforeEach } from 'node:test';
import { courseStub } from './course-stub';
import { IO_TIMEOUT_MS } from './deadlines';
import { boundKafkaAdminConnections } from './kafka-handles';

async function main() {
  const target = new URL(process.env.DATABASE_URL!);
  if (
    !/^learning_it_[a-f0-9]{32}$/.test(
      process.env.LEARNING_IT_DATABASE ?? '',
    ) ||
    target.pathname !== `/${process.env.LEARNING_IT_DATABASE}`
  )
    throw new Error('Integration tests require the disposable database runner');
  const stub = await courseStub.start();
  process.env.COURSE_SERVICE_URL = stub.url;
  const closeKafka = boundKafkaAdminConnections();
  // Prisma constructs its own pg pools. Bound those too, without changing the
  // application's pool configuration or relying on libpq-only environment knobs.
  const pg: typeof import('pg') = require('pg');
  const OriginalPool = pg.Pool;
  pg.Pool = class extends OriginalPool {
    constructor(config?: import('pg').PoolConfig) {
      super({
        ...config,
        statement_timeout: IO_TIMEOUT_MS,
        connectionTimeoutMillis: IO_TIMEOUT_MS,
      });
    }
  };
  beforeEach(() => courseStub.reset());
  try {
    // Import only after DATABASE_URL and the listening HTTP stub are ready.
    const suite = process.env.LEARNING_IT_SUITE;
    if (suite) {
      const index = require('node:fs').readFileSync(
        require('node:path').join(__dirname, 'index.ts'),
        'utf8',
      ) as string;
      if (
        !/^[a-z-]+$/.test(suite) ||
        !index.includes(`import './${suite}.integration-test';`)
      )
        throw new Error(
          'LEARNING_IT_SUITE must name a suite imported by index.ts',
        );
      require('./tenant-lookup-config');
      require(`./${suite}.integration-test`);
    } else {
      require('./index');
    }
  } catch (error) {
    await Promise.allSettled([stub.close(), closeKafka()]);
    pg.Pool = OriginalPool;
    throw error;
  }
  after(async () => {
    try {
      const { closeAll } =
        require('./deadlines') as typeof import('./deadlines');
      await closeAll(() => stub.close(), closeKafka);
    } finally {
      pg.Pool = OriginalPool;
    }
  });
}
export const ready = main();
