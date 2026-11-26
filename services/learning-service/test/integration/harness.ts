import { after, beforeEach } from 'node:test';
import { courseStub } from './course-stub';
import { IO_TIMEOUT_MS } from './deadlines';
import { boundKafkaAdminConnections } from './kafka-handles';
import { finishCleanup, type CleanupTask } from './cleanup';

async function main() {
  const target = new URL(process.env.DATABASE_URL!);
  if (
    !/^learning_it_[a-f0-9]{32}$/.test(
      process.env.LEARNING_IT_DATABASE ?? '',
    ) ||
    target.pathname !== `/${process.env.LEARNING_IT_DATABASE}`
  )
    throw new Error('Integration tests require the disposable database runner');
  const cleanup: CleanupTask[] = [];
  try {
    const stub = await courseStub.start();
    cleanup.push({ name: 'Course stub', run: () => stub.close() });
    process.env.COURSE_SERVICE_URL = stub.url;
    const closeKafka = boundKafkaAdminConnections();
    cleanup.push({ name: 'native Kafka handles', run: closeKafka });
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
    cleanup.push({
      name: 'pg Pool override',
      run: () => {
        pg.Pool = OriginalPool;
      },
    });
    beforeEach(() => courseStub.reset());
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
    await finishCleanup(cleanup, error);
  }
  // File hooks collect failures instead of aborting this final root hook.
  after(async () => {
    await finishCleanup(cleanup);
  });
}
export const ready = main();
