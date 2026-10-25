/**
 * Shared set-up of the integration tests: a throw-away Postgres database (migrated with the real migrations),
 * the real service started from `dist/` as a child process, and a fake Course Service.
 * Needs Postgres reachable through DATABASE_URL (see .env), nothing else.
 *
 * Run: npm run test:integration (it builds first)
 */
import 'dotenv/config';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { Client } from 'pg';

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Refusing to run: NODE_ENV=production. These tests create and drop databases.',
  );
}

export const SERVICE_DIR = process.cwd();
export const KEY = 'integration-test-key';
export const ORG = '00000000-0000-4000-8000-000000000001';
export const INSTRUCTOR = '00000000-0000-4000-8000-000000000002';
export const OTHER_INSTRUCTOR = '00000000-0000-4000-8000-0000000000aa';
export const OTHER_ORG = '00000000-0000-4000-8000-0000000000bb';
export const LEARNER = '00000000-0000-4000-8000-0000000000c1';
export const COURSE = '00000000-0000-4000-8000-000000000004';
export const UNKNOWN = '00000000-0000-4000-8000-0000000000ff';

// ---------------------------------------------------------------------------------------------- database

export interface TestDatabase {
  name: string;
  url: string;
  /** Run SQL against the test database. */
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<Record<string, unknown>[]>;
  /** A separate connection, e.g. to hold a transaction open next to the service. */
  connect: () => Promise<Client>;
  drop: () => Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const base = new URL(
    process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/assessment_db',
  );
  const name = `assessment_it_${process.pid}_${Date.now()}`;

  const admin = new Client({ connectionString: base.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);

  const url = new URL(base.toString());
  url.pathname = `/${name}`;
  const connectionString = url.toString();

  // Real migrations, so the tests see the real schema (constraints, ON DELETE CASCADE...).
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: SERVICE_DIR,
    env: { ...process.env, DATABASE_URL: connectionString },
    shell: true, // npx is a .cmd on Windows
    stdio: 'pipe',
  });

  const client = new Client({ connectionString });
  await client.connect();
  const opened: Client[] = [client];

  return {
    name,
    url: connectionString,
    query: async (sql, params) =>
      (await client.query(sql, params)).rows as Record<string, unknown>[],
    connect: async () => {
      const extra = new Client({ connectionString });
      await extra.connect();
      opened.push(extra);
      return extra;
    },
    drop: async () => {
      for (const c of opened) await c.end().catch(() => undefined);
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.end();
    },
  };
}

// ---------------------------------------------------------------------------------------------- fake Course Service

export interface CourseState {
  status: string;
  locked: boolean;
  disabled: boolean;
  instructorId: string;
  organizationId: string;
  /** Answer 404 / 500 instead of the Course facts. */
  respond: 'ok' | '404' | '500';
}

export interface CourseStub {
  url: string;
  state: CourseState;
  /** The totals Course Service was told for the Assignment minutes, in order. */
  minutes: number[];
  /** true = answer 500 when told the minutes (the Course facts still answer). */
  failMinutes: { value: boolean };
  /** Put the Course back to an unlocked Draft owned by INSTRUCTOR. */
  reset: () => void;
  stop: () => Promise<void>;
}

export async function startCourseStub(): Promise<CourseStub> {
  const initial = (): CourseState => ({
    status: 'Draft',
    locked: false,
    disabled: false,
    instructorId: INSTRUCTOR,
    organizationId: ORG,
    respond: 'ok',
  });
  const state = initial();
  const minutes: number[] = [];
  const failMinutes = { value: false };
  const server: Server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.headers['x-internal-key'] !== KEY) {
      res.statusCode = 401;
      return res.end('{}');
    }
    if (req.method === 'POST' && req.url?.endsWith('/assignment-minutes')) {
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => {
        if (failMinutes.value) {
          res.statusCode = 500;
          return res.end('{}');
        }
        minutes.push((JSON.parse(raw) as { minutes: number }).minutes);
        res.end(JSON.stringify({ statusCode: 200, message: 'ok', data: {} }));
      });
      return;
    }
    if (state.respond !== 'ok') {
      res.statusCode = Number(state.respond);
      return res.end('{}');
    }
    const { respond, ...facts } = state;
    void respond;
    res.end(
      JSON.stringify({
        statusCode: 200,
        message: 'ok',
        data: { courseId: COURSE, ...facts },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    state,
    minutes,
    failMinutes,
    reset: () => {
      Object.assign(state, initial());
      minutes.length = 0;
      failMinutes.value = false;
    },
    stop: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

// ---------------------------------------------------------------------------------------------- a fake Learning Service

/** What the fake Learning Service answers for assessment-access (L17). */
export type LearningAnswer = 'Full' | 'ReadOnly' | 'None' | 'NotFound' | '500';

export interface LearningStub {
  url: string;
  /** Answer for one Learner on one Course; every other pair gets Full. */
  setAnswer: (learnerId: string, courseId: string, answer: LearningAnswer) => void;
  /** Put every answer back to Full and forget the calls. */
  reset: () => void;
  /** The questions Learning Service received, in order. */
  calls: { learnerId: string; courseId: string; headers: Record<string, unknown> }[];
  stop: () => Promise<void>;
}

const STATUS_OF = { Full: 'InProgress', ReadOnly: 'Completed', None: 'Halted' } as const;

/**
 * A Learning Service that answers GET /api/v1/internal/enrollments/assessment-access like the real one: it wants the
 * internal key and the Learner identity headers (401 without them) and answers { statusCode, message, data }.
 */
export async function startLearningStub(): Promise<LearningStub> {
  const answers = new Map<string, LearningAnswer>();
  const calls: LearningStub['calls'] = [];
  const server: Server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    const url = new URL(req.url ?? '', 'http://stub');
    const h = req.headers;
    if (
      h['x-internal-key'] !== KEY ||
      !h['x-user-id'] ||
      !h['x-organization-id'] ||
      !h['x-user-role']
    ) {
      res.statusCode = 401;
      return res.end('{}');
    }
    if (url.pathname !== '/api/v1/internal/enrollments/assessment-access') {
      res.statusCode = 404;
      return res.end(JSON.stringify({ statusCode: 404, error: { message: 'no route' } }));
    }
    const learnerId = url.searchParams.get('learnerId') ?? '';
    const courseId = url.searchParams.get('courseId') ?? '';
    calls.push({ learnerId, courseId, headers: { ...h } });
    const answer = answers.get(`${learnerId}|${courseId}`) ?? 'Full';
    if (answer === 'NotFound') {
      res.statusCode = 404;
      return res.end(
        JSON.stringify({ statusCode: 404, error: { code: 'ENROLLMENT_NOT_FOUND', message: 'none' } }),
      );
    }
    if (answer === '500') {
      res.statusCode = 500;
      return res.end('{}');
    }
    res.end(
      JSON.stringify({
        statusCode: 200,
        message: 'ok',
        data: {
          enrollmentId: '00000000-0000-4000-8000-0000000000e1',
          status: STATUS_OF[answer],
          access: answer,
        },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    setAnswer: (learnerId, courseId, answer) =>
      answers.set(`${learnerId}|${courseId}`, answer),
    reset: () => {
      answers.clear();
      calls.length = 0;
    },
    calls,
    stop: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

// ---------------------------------------------------------------------------------------------- the service

export interface RunningService {
  baseUrl: string;
  log: () => string;
  stop: () => Promise<void>;
}

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

/**
 * Start the built service (dist/src/main.js). Every setting the tests care about is given explicitly, because the
 * service also reads its own `.env`, which must not change what a test means.
 */
export async function startService(
  databaseUrl: string,
  env: Record<string, string> = {},
): Promise<RunningService> {
  const port = await freePort();
  const child: ChildProcess = spawn(process.execPath, ['dist/src/main.js'], {
    cwd: SERVICE_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: databaseUrl,
      INTERNAL_SERVICE_KEY: KEY,
      COURSE_CLIENT_MODE: 'http',
      COURSE_SERVICE_URL: 'http://127.0.0.1:9',
      COURSE_SERVICE_TIMEOUT_MS: '2000',
      FAKE_COURSE_STATUS: 'Draft',
      FAKE_COURSE_LOCKED: 'false',
      // The tests never reach Cloudinary; the storage only needs to be constructible.
      PROMPT_FILE_VERIFY: 'off', // no HEAD request to the storage
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret',
      ...env,
    },
  });
  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));
  const baseUrl = `http://127.0.0.1:${port}`;

  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) {
      throw new Error(`Service exited early:\n${output}`);
    }
    try {
      if ((await fetch(`${baseUrl}/docs`)).ok) break;
    } catch {
      /* not listening yet */
    }
    await sleep(250);
    if (i === 79) {
      child.kill();
      throw new Error(`Service did not start in time:\n${output}`);
    }
  }

  return {
    baseUrl,
    log: () => output,
    stop: async () => {
      if (child.exitCode === null) {
        const exited = new Promise((resolve) => child.once('exit', resolve));
        child.kill();
        await exited;
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------- HTTP helper

export interface ApiResult {
  status: number;
  /** `error.code` of a failed response. */
  code?: string;
  data: Record<string, any>;
  json: Record<string, any>;
}

export const identity = (
  over: Partial<Record<'user' | 'org' | 'role', string>> = {},
): Record<string, string> => ({
  'x-internal-key': KEY,
  'x-user-id': over.user ?? INSTRUCTOR,
  'x-organization-id': over.org ?? ORG,
  'x-user-role': over.role ?? 'INSTRUCTOR',
});

export function apiFor(baseUrl: string) {
  return async (
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = identity(),
  ): Promise<ApiResult> => {
    const response = await fetch(`${baseUrl}/api/v1/assessments${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await response.json().catch(() => ({}))) as ApiResult['json'];
    return {
      status: response.status,
      code: json?.error?.code,
      data: json?.data,
      json,
    };
  };
}

export { sleep };
