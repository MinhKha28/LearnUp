/**
 * Unit test CourseServiceClient với server HTTP giả cục bộ: ánh xạ lỗi, kiểm hợp đồng I1/I2 (D16),
 * chuyển tiếp header. Không cần course-service hay database.
 */
import assert from 'node:assert/strict';
import {
  createServer,
  IncomingMessage,
  Server,
  ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, test } from 'node:test';
import { ConsoleLogger, Logger } from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';
import { CourseServiceClient } from '../../src/integrations/course-service/course-service.client';
import {
  CourseNotAvailableError,
  CourseServiceConfigurationError,
  CourseServiceContractError,
  CourseServiceError,
  CourseServiceUnavailableError,
} from '../../src/integrations/course-service/course-service.errors';

const INTERNAL_KEY = 'unit-test-internal-key';
const ORG = '0199a000-0000-7000-8000-0a0000000001';
const COURSE = '0199a000-0000-7000-8000-0e0000000003';
const CHAIN = '0199a000-0000-7000-8000-0d0000000002';
const USER: CurrentUser = {
  userId: '0199a000-0000-7000-8000-0b0000000001',
  organizationId: ORG,
  role: 'LEARNER',
  isAuthenticated: true,
};

interface RecordedRequest {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: string;
}

type Handler = (request: RecordedRequest, response: ServerResponse) => void;

let server: Server;
let baseUrl: string;
let handler: Handler;
let requests: RecordedRequest[];
const logs: string[] = [];

function reply(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

const ok =
  (data: unknown): Handler =>
  (_req, res) =>
    reply(res, 200, { statusCode: 200, message: '', data });

const fail =
  (status: number, code?: string): Handler =>
  (_req, res) =>
    reply(res, status, {
      statusCode: status,
      error: code ? { code, message: `${code} message` } : 'error',
    });

function client(timeoutMs = 1000): CourseServiceClient {
  return new CourseServiceClient({
    baseUrl,
    internalKey: INTERNAL_KEY,
    timeoutMs,
  });
}

const lockedCourse = (overrides: Record<string, unknown> = {}) => ({
  courseId: COURSE,
  organizationId: ORG,
  chainId: CHAIN,
  expectedCompletionDays: 7,
  courseType: 'Public',
  lockedAt: '2026-10-01T02:35:42.509Z',
  ...overrides,
});

const material = (overrides: Record<string, unknown> = {}) => ({
  id: '0199a000-0000-7000-8000-1c0000000211',
  title: 'Bài giảng',
  position: 1,
  materialType: 'Video',
  isRequired: true,
  durationSeconds: 480,
  disabledAt: null,
  ...overrides,
});

const courseTree = (materials: unknown[] = [material()]) => ({
  courseId: COURSE,
  chainId: CHAIN,
  versionNumber: 1,
  disabledAt: null,
  asOf: '2026-10-01T02:35:44.580Z',
  modules: [
    {
      id: '0199a000-0000-7000-8000-1a0000000021',
      title: 'Module',
      position: 1,
      lessons: [
        {
          id: '0199a000-0000-7000-8000-1b0000000021',
          title: 'Lesson',
          position: 1,
          disabledAt: null,
          materials,
        },
      ],
    },
  ],
});

async function assertContractError(
  promise: Promise<unknown>,
  field: string,
): Promise<void> {
  const before = logs.length;
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof CourseServiceContractError);
    assert.equal(error.field, field);
    return true;
  });
  assert.ok(
    logs.slice(before).some((line) => line.includes(field)),
    `logger.error phải nêu trường ${field}`,
  );
}

before(async () => {
  Logger.overrideLogger({
    log: () => undefined,
    warn: (message: unknown) => logs.push(String(message)),
    error: (message: unknown) => logs.push(String(message)),
  });
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    req.on('end', () => {
      const recorded = {
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body,
      };
      requests.push(recorded);
      handler(recorded, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => {
  requests = [];
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  Logger.overrideLogger(new ConsoleLogger());
});

void describe('CourseServiceClient – I1 lock', () => {
  void test('thành công: trả LockedCourse đã đổi kiểu, chuyển tiếp đúng header và body', async () => {
    handler = ok(lockedCourse());
    const result = await client().lockCourse(USER, COURSE, true);

    assert.deepEqual(result, {
      ...lockedCourse(),
      lockedAt: new Date('2026-10-01T02:35:42.509Z'),
    });
    const [request] = requests;
    assert.equal(request.method, 'POST');
    assert.equal(request.url, `/api/v1/internal/courses/${COURSE}/lock`);
    assert.deepEqual(JSON.parse(request.body), { selfEnroll: true });
    assert.equal(request.headers['x-internal-key'], INTERNAL_KEY);
    assert.equal(request.headers['x-user-id'], USER.userId);
    assert.equal(request.headers['x-user-role'], 'LEARNER');
    assert.equal(request.headers['x-organization-id'], ORG);
  });

  void test('409 COURSE_NOT_AVAILABLE → CourseNotAvailableError', async () => {
    handler = fail(409, 'COURSE_NOT_AVAILABLE');
    await assert.rejects(client().lockCourse(USER, COURSE, true), (error) => {
      assert.ok(error instanceof CourseNotAvailableError);
      assert.equal(error.code, 'COURSE_NOT_AVAILABLE');
      return true;
    });
  });

  void test('404 COURSE_NOT_FOUND → CourseNotAvailableError', async () => {
    handler = fail(404, 'COURSE_NOT_FOUND');
    await assert.rejects(client().lockCourse(USER, COURSE, false), (error) => {
      assert.ok(error instanceof CourseNotAvailableError);
      assert.equal(error.code, 'COURSE_NOT_FOUND');
      return true;
    });
  });

  void test('hết giờ → CourseServiceUnavailableError', async () => {
    handler = (_req, res) => {
      setTimeout(() => ok(lockedCourse())(_req, res), 500);
    };
    await assert.rejects(
      client(100).lockCourse(USER, COURSE, true),
      CourseServiceUnavailableError,
    );
  });

  void test('5xx → CourseServiceUnavailableError, không tự retry', async () => {
    handler = fail(503);
    await assert.rejects(
      client().lockCourse(USER, COURSE, true),
      CourseServiceUnavailableError,
    );
    assert.equal(requests.length, 1);
  });

  void test('lỗi mạng (không kết nối được) → CourseServiceUnavailableError', async () => {
    const unreachable = new CourseServiceClient({
      baseUrl: 'http://127.0.0.1:1',
      internalKey: INTERNAL_KEY,
      timeoutMs: 1000,
    });
    await assert.rejects(
      unreachable.lockCourse(USER, COURSE, true),
      CourseServiceUnavailableError,
    );
  });

  void test('401 → CourseServiceConfigurationError, có logger.error, không log khóa nội bộ', async () => {
    handler = fail(401);
    const before = logs.length;
    await assert.rejects(
      client().lockCourse(USER, COURSE, true),
      CourseServiceConfigurationError,
    );
    assert.ok(logs.slice(before).some((line) => line.includes('HTTP 401')));
    assert.ok(logs.every((line) => !line.includes(INTERNAL_KEY)));
  });

  void test('403 → CourseServiceConfigurationError', async () => {
    handler = fail(403);
    await assert.rejects(
      client().lockCourse(USER, COURSE, true),
      CourseServiceConfigurationError,
    );
  });

  void test('400 (không thuộc các nhóm trên) → CourseServiceError gốc', async () => {
    handler = fail(400);
    await assert.rejects(client().lockCourse(USER, COURSE, true), (error) => {
      assert.ok(error instanceof CourseServiceError);
      assert.ok(!(error instanceof CourseNotAvailableError));
      assert.ok(!(error instanceof CourseServiceUnavailableError));
      return true;
    });
  });

  for (const [field, data] of [
    [
      'organizationId',
      lockedCourse({ organizationId: '0199a000-0000-7000-8000-0a0000000002' }),
    ],
    ['courseType', lockedCourse({ courseType: 'Hidden' })],
    ['chainId', lockedCourse({ chainId: 'khong-phai-uuid' })],
    ['expectedCompletionDays', lockedCourse({ expectedCompletionDays: 0 })],
    ['expectedCompletionDays', lockedCourse({ expectedCompletionDays: 366 })],
    ['expectedCompletionDays', lockedCourse({ expectedCompletionDays: 7.5 })],
    ['lockedAt', lockedCourse({ lockedAt: 'not-a-date' })],
    ['chainId', lockedCourse({ chainId: undefined })],
  ] as const) {
    void test(`hợp đồng I1: ${field} = ${JSON.stringify((data as Record<string, unknown>)[field])} → CourseServiceContractError`, async () => {
      handler = ok(data);
      await assertContractError(client().lockCourse(USER, COURSE, true), field);
    });
  }

  void test('hợp đồng I1: thiếu data trong response → CourseServiceContractError', async () => {
    handler = (_req, res) => reply(res, 200, { statusCode: 200 });
    await assertContractError(client().lockCourse(USER, COURSE, true), 'data');
  });
});

void describe('CourseServiceClient – I2 tree', () => {
  void test('cây hợp lệ: đổi thời điểm sang Date, Reading có durationSeconds null', async () => {
    handler = ok(
      courseTree([
        material(),
        material({
          id: '0199a000-0000-7000-8000-1c0000000212',
          materialType: 'Reading',
          durationSeconds: null,
          disabledAt: '2026-09-30T00:00:00.000Z',
        }),
      ]),
    );
    const tree = await client().getCourseTree(USER, COURSE);
    assert.ok(tree.asOf instanceof Date);
    const [video, reading] = tree.modules[0].lessons[0].materials;
    assert.equal(video.durationSeconds, 480);
    assert.equal(reading.durationSeconds, null);
    assert.ok(reading.disabledAt instanceof Date);
    assert.equal(requests[0].method, 'GET');
    assert.equal(requests[0].url, `/api/v1/internal/courses/${COURSE}/tree`);
  });

  const materialPath = 'modules[0].lessons[0].materials[0]';
  for (const [name, field, bad] of [
    [
      'Video không có durationSeconds',
      'durationSeconds',
      material({ durationSeconds: null }),
    ],
    [
      'Video durationSeconds = 0',
      'durationSeconds',
      material({ durationSeconds: 0 }),
    ],
    [
      'Reading có durationSeconds',
      'durationSeconds',
      material({ materialType: 'Reading', durationSeconds: 300 }),
    ],
    ['materialType lạ', 'materialType', material({ materialType: 'Audio' })],
    ['ID học liệu không phải UUID', 'id', material({ id: 'm1-l1-video' })],
    [
      'isRequired không phải boolean',
      'isRequired',
      material({ isRequired: 'true' }),
    ],
    [
      'disabledAt không phải thời điểm',
      'disabledAt',
      material({ disabledAt: 'hôm qua' }),
    ],
  ] as const) {
    void test(`hợp đồng I2: ${name} → CourseServiceContractError`, async () => {
      handler = ok(courseTree([bad]));
      await assertContractError(
        client().getCourseTree(USER, COURSE),
        `${materialPath}.${field}`,
      );
    });
  }

  void test('hợp đồng I2: asOf không hợp lệ → CourseServiceContractError', async () => {
    handler = ok({ ...courseTree(), asOf: '2026-13-45' });
    await assertContractError(client().getCourseTree(USER, COURSE), 'asOf');
  });

  void test('hợp đồng I2: ID module không phải UUID → CourseServiceContractError', async () => {
    const tree = courseTree();
    tree.modules[0].id = 'm1';
    handler = ok(tree);
    await assertContractError(
      client().getCourseTree(USER, COURSE),
      'modules[0].id',
    );
  });

  void test('Lesson có materials: [] và Module có lessons: [] được chấp nhận (D30)', async () => {
    const tree = courseTree([]);
    handler = ok({
      ...tree,
      modules: [
        ...tree.modules,
        {
          id: '0199a000-0000-7000-8000-1a0000000022',
          title: 'Module rỗng',
          position: 2,
          lessons: [],
        },
      ],
    });
    const parsed = await client().getCourseTree(USER, COURSE);
    assert.deepEqual(parsed.modules[0].lessons[0].materials, []);
    assert.deepEqual(parsed.modules[1].lessons, []);
  });

  void test('404 → CourseNotAvailableError', async () => {
    handler = fail(404, 'COURSE_NOT_FOUND');
    await assert.rejects(
      client().getCourseTree(USER, COURSE),
      CourseNotAvailableError,
    );
  });
});

void describe('CourseServiceClient – I3, I4', () => {
  void test('I3 gửi courseIds và trả nguyên mảng', async () => {
    const items = [
      {
        courseId: COURSE,
        chainId: CHAIN,
        versionNumber: 1,
        name: 'Bảo mật thông tin',
        courseType: 'Public',
        status: 'Published',
        coverFileId: null,
      },
    ];
    handler = ok(items);
    assert.deepEqual(await client().getCoursesBatch(USER, [COURSE]), items);
    assert.deepEqual(JSON.parse(requests[0].body), { courseIds: [COURSE] });
  });

  void test('I4 404 LESSON_NOT_FOUND → CourseNotAvailableError', async () => {
    handler = fail(404, 'LESSON_NOT_FOUND');
    await assert.rejects(
      client().getLesson(USER, COURSE, '0199a000-0000-7000-8000-1b0000000021'),
      (error) => {
        assert.ok(error instanceof CourseNotAvailableError);
        assert.equal(error.code, 'LESSON_NOT_FOUND');
        return true;
      },
    );
  });
});
