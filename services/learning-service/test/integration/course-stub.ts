import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type {
  CourseBatchItem,
  CourseTree,
  LessonContent,
  LockedCourse,
} from '../../src/infrastructure/clients/course/course-service.interface';
import { deadline } from './deadlines';

const id = (part: string, tail: string) =>
  `0199a000-0000-7000-8000-${part}00000000${tail}`;
export const FIXTURE_ORG = id('0a', 'f2');
export const PUBLIC = id('0e', 'f1');
export const PRIVATE = id('0e', 'f2');
export const DEMO = '0199a000-0000-7000-8000-0e0000000002';
export const SECOND = '0199a000-0000-7000-8000-0e0000000003';
export const OTHER = '0199a000-0000-7000-8000-0e0000000006';
const DEMO_ORG = '0199a000-0000-7000-8000-0a0000000001';
const asOf = new Date('2026-10-20T00:00:00Z');
type Answer = {
  status: number;
  data?: unknown;
  error?: { code: string; message: string };
};
type Call = {
  method: string;
  path: string;
  body: Record<string, unknown>;
  organizationId: string;
};

/** Routes are keyed by request facts; configured answers never implement Course rules. */
export class CourseStub {
  readonly calls: Call[] = [];
  private readonly answers = new Map<string, Answer>();
  private key(method: string, path: string, org: string, selfEnroll?: boolean) {
    return JSON.stringify([method, path, org, selfEnroll]);
  }
  answer(
    method: string,
    path: string,
    org: string,
    answer: Answer,
    selfEnroll?: boolean,
  ) {
    this.answers.set(this.key(method, path, org, selfEnroll), answer);
  }
  lock(course: string, org: string, selfEnroll: boolean, answer: Answer) {
    this.answer('POST', `/${course}/lock`, org, answer, selfEnroll);
  }
  reset() {
    this.answers.clear();
    this.calls.length = 0;
    for (const [courseId, courseType] of [
      [PUBLIC, 'Public'],
      [PRIVATE, 'Private'],
    ] as const) {
      const lock: LockedCourse = {
        courseId,
        organizationId: FIXTURE_ORG,
        chainId: courseId,
        expectedCompletionDays: 3,
        courseType,
        lockedAt: asOf,
      };
      this.lock(courseId, FIXTURE_ORG, false, { status: 200, data: lock });
      this.lock(
        courseId,
        FIXTURE_ORG,
        true,
        courseId === PRIVATE
          ? {
              status: 409,
              error: {
                code: 'COURSE_NOT_AVAILABLE',
                message: 'Unavailable fixture',
              },
            }
          : { status: 200, data: lock },
      );
      const lessonId = id('1b', courseId === PUBLIC ? 'f1' : 'f2');
      const tree: CourseTree = {
        courseId,
        chainId: courseId,
        versionNumber: 1,
        disabledAt: null,
        asOf,
        modules: [
          {
            id: id('1a', courseId === PUBLIC ? 'f1' : 'f2'),
            title: 'Module kiểm thử',
            position: 1,
            lessons: [
              {
                id: lessonId,
                title: 'Lesson kiểm thử',
                position: 1,
                disabledAt: null,
                materials: [
                  {
                    id: id('1c', courseId === PUBLIC ? 'f1' : 'f3'),
                    title: 'Video kiểm thử (bắt buộc)',
                    position: 1,
                    materialType: 'Video',
                    isRequired: true,
                    durationSeconds: 300,
                    disabledAt: null,
                  },
                  {
                    id: id('1c', courseId === PUBLIC ? 'f2' : 'f4'),
                    title: 'Reading kiểm thử (không bắt buộc)',
                    position: 2,
                    materialType: 'Reading',
                    isRequired: false,
                    durationSeconds: null,
                    disabledAt: null,
                  },
                ],
              },
            ],
          },
        ],
      };
      this.answer('GET', `/${courseId}/tree`, FIXTURE_ORG, {
        status: 200,
        data: tree,
      });
      const lesson: LessonContent = {
        lessonId,
        courseId,
        title: 'Lesson kiểm thử',
        content: '## Lesson kiểm thử\n\nNội dung cố định cho test tích hợp.',
        disabledAt: null,
      };
      this.answer('GET', `/${courseId}/lessons/${lessonId}`, FIXTURE_ORG, {
        status: 200,
        data: lesson,
      });
    }
    const batch: CourseBatchItem[] = [PUBLIC, PRIVATE].map((courseId) => ({
      courseId,
      chainId: courseId,
      versionNumber: 1,
      name: 'Course kiểm thử tích hợp (không dùng cho demo)',
      courseType: courseId === PUBLIC ? 'Public' : 'Private',
      status: 'Published',
      coverFileId: null,
    }));
    this.answer('POST', '/batch', FIXTURE_ORG, { status: 200, data: batch });
    const demoTree: CourseTree = {
      courseId: DEMO,
      chainId: DEMO,
      versionNumber: 2,
      disabledAt: null,
      asOf,
      modules: [1, 2].map((position) => ({
        id: id('1a', `0${position}`),
        title: 'Module',
        position,
        lessons: [
          {
            id: id('1b', `1${position}`),
            title: 'Lesson',
            position: 1,
            disabledAt: null,
            materials: Array.from(
              { length: position === 1 ? 5 : 4 },
              (_, n) => ({
                id: id('1c', `${position}${n}`),
                title: 'Material',
                position: n + 1,
                materialType: n % 2 ? ('Reading' as const) : ('Video' as const),
                isRequired: true,
                durationSeconds: n % 2 ? null : 300,
                disabledAt: null,
              }),
            ),
          },
        ],
      })),
    };
    this.answer('GET', `/${DEMO}/tree`, DEMO_ORG, {
      status: 200,
      data: demoTree,
    });
    const demoBatch: CourseBatchItem[] = [DEMO, SECOND].map((courseId, n) => ({
      courseId,
      chainId: courseId,
      versionNumber: 2,
      name: n ? 'Bảo mật thông tin' : 'An toàn lao động',
      courseType: 'Public',
      status: 'Published',
      coverFileId: null,
    }));
    this.answer('POST', '/batch', DEMO_ORG, { status: 200, data: demoBatch });
    const demoLesson: LessonContent = {
      lessonId: id('1b', '11'),
      courseId: DEMO,
      title: 'Lesson',
      content: '## Integration content',
      disabledAt: null,
    };
    this.answer('GET', `/${DEMO}/lessons/${demoLesson.lessonId}`, DEMO_ORG, {
      status: 200,
      data: demoLesson,
    });
    // Learning's own demo-reset/withdrawal fixtures; no Course seed/code is imported.
    const demoResetOrg = '01900000-0000-7000-8000-00000000a001';
    for (const [n, courseId] of [
      '01900000-0000-7000-8000-c0020000005c',
      '01900000-0000-7000-8000-c00200000097',
    ].entries()) {
      const lessonId = id('1b', `e${n}`);
      const lock: LockedCourse = {
        courseId,
        organizationId: demoResetOrg,
        chainId: courseId,
        expectedCompletionDays: 3,
        courseType: 'Public',
        lockedAt: asOf,
      };
      this.lock(courseId, demoResetOrg, true, { status: 200, data: lock });
      const tree: CourseTree = {
        courseId,
        chainId: courseId,
        versionNumber: 1,
        disabledAt: null,
        asOf,
        modules: [
          {
            id: id('1a', `e${n}`),
            title: 'Demo reset module',
            position: 1,
            lessons: [
              {
                id: lessonId,
                title: 'Demo reset lesson',
                position: 1,
                disabledAt: null,
                materials: [
                  {
                    id: id('1c', `e${n}`),
                    title: 'Demo video',
                    position: 1,
                    materialType: 'Video',
                    isRequired: true,
                    durationSeconds: 300,
                    disabledAt: null,
                  },
                ],
              },
            ],
          },
        ],
      };
      this.answer('GET', `/${courseId}/tree`, demoResetOrg, {
        status: 200,
        data: tree,
      });
    }
    const resetBatch: CourseBatchItem[] = [
      '01900000-0000-7000-8000-c0020000005c',
      '01900000-0000-7000-8000-c00200000097',
    ].map((courseId) => ({
      courseId,
      chainId: courseId,
      versionNumber: 1,
      name: 'Demo reset fixture',
      courseType: 'Public',
      status: 'Published',
      coverFileId: null,
    }));
    this.answer('POST', '/batch', demoResetOrg, {
      status: 200,
      data: resetBatch,
    });
  }
  async start() {
    this.reset();
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        res.setHeader('content-type', 'application/json');
        if (
          req.headers['x-internal-key'] !== process.env.INTERNAL_SERVICE_KEY
        ) {
          res.writeHead(401).end('{}');
          return;
        }
        let body: Record<string, unknown>;
        try {
          body = chunks.length
            ? (JSON.parse(Buffer.concat(chunks).toString()) as Record<
                string,
                unknown
              >)
            : {};
        } catch {
          res.writeHead(400).end('{}');
          return;
        }
        const path = new URL(req.url!, 'http://stub').pathname.replace(
          /^\/api\/v1\/internal\/courses/,
          '',
        );
        const org = String(req.headers['x-organization-id'] ?? '');
        this.calls.push({
          method: req.method!,
          path,
          body,
          organizationId: org,
        });
        const answer = this.answers.get(
          this.key(
            req.method!,
            path,
            org,
            body.selfEnroll as boolean | undefined,
          ),
        ) ?? {
          status: 404,
          error: { code: 'COURSE_NOT_FOUND', message: 'Unconfigured fixture' },
        };
        res.statusCode = answer.status;
        res.end(
          JSON.stringify(
            answer.error ? { error: answer.error } : { data: answer.data },
          ),
        );
      });
    });
    server.requestTimeout = Number(process.env.COURSE_SERVICE_TIMEOUT_MS);
    await deadline(
      new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      }),
      'Course stub listen',
    );
    return {
      url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      close: () =>
        deadline(
          new Promise<void>((resolve, reject) => {
            server.closeAllConnections();
            server.close((error) => (error ? reject(error) : resolve()));
          }),
          'Course stub close',
        ),
    };
  }
}
export const courseStub = new CourseStub();
