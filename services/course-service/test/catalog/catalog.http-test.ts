/**
 * Test HTTP cho UC25 (danh mục) và UC25.1 (giới thiệu Course) trên dữ liệu seed.
 * Cần course-service đang chạy và đã chạy npm run prisma:seed.
 * Ca Unicode dùng DATABASE_URL của service để tạo và dọn dữ liệu riêng.
 *
 * Chạy: npm run test:catalog:http
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import type { CatalogPageDto } from '../../src/modules/catalog/dto/catalog-page.dto';
import type { CourseIntroductionDto } from '../../src/modules/catalog/dto/course-introduction.dto';

const BASE_URL = `${process.env.COURSE_SERVICE_URL ?? `http://localhost:${process.env.PORT ?? 8083}`}/api/v1/courses`;

const ORG_A = '01900000-0000-7000-8000-00000000a001';
const LEARNER_1 = '01900000-0000-7000-8000-00000000a201';
const INSTRUCTOR_1 = '01900000-0000-7000-8000-00000000a101';
/** Tổ chức không có Course nào (dùng chung với test:catalog:db, chỉ tồn tại trong transaction đã rollback). */
const EMPTY_ORG = '0199a000-0000-7000-8000-0a00000000f1';

// prisma/seed.ts CASES, introduced by test(course): expand seed data (81ac5f6a).
const COURSE = {
  archivedVersion: '01900000-0000-7000-8000-c0020000005b',
  publishedVersion: '01900000-0000-7000-8000-c0020000005c',
  publishedPrivate: '01900000-0000-7000-8000-c00200000065',
  publishedLocked: '01900000-0000-7000-8000-c0020000006f',
  disabledMaterial: '01900000-0000-7000-8000-c00200000079',
  disabledCourse: '01900000-0000-7000-8000-c00200000083',
  noAssignment: '01900000-0000-7000-8000-c00200000097',
  draft: '01900000-0000-7000-8000-c0020000000b',
  foreign: randomUUID(),
};
const CATALOG_IDS = [
  COURSE.publishedVersion,
  COURSE.noAssignment,
  COURSE.disabledMaterial,
  COURSE.publishedLocked,
];
const CATALOG_TOTAL = CATALOG_IDS.length;
const FOREIGN_ORG = randomUUID();
const FOREIGN_CHAIN = randomUUID();
const FOREIGN_FILE = randomUUID();
const fixturePrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

before(async () => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  // The canonical seed has one organization and no optional-only Published lesson.
  // Own these missing negative/edge-case fixtures instead of asserting on absent IDs.
  await fixturePrisma.$transaction(async (tx) => {
    await tx.mediaFile.create({
      data: {
        id: FOREIGN_FILE,
        organizationId: FOREIGN_ORG,
        purpose: 'MaterialVideo',
        status: 'Ready',
        storageKey: 'catalog-test/' + FOREIGN_FILE,
        originalFilename: 'optional.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 1n,
        durationSeconds: 600,
        readyAt: new Date(),
      },
    });
    await tx.courseChain.create({
      data: {
        id: FOREIGN_CHAIN,
        organizationId: FOREIGN_ORG,
        instructorId: INSTRUCTOR_1,
        courses: {
          create: {
            id: COURSE.foreign,
            organizationId: FOREIGN_ORG,
            versionNumber: 1,
            name: 'Foreign optional-only course',
            learningOutcomes: [],
            expectedCompletionDays: 7,
            courseType: 'Public',
            status: 'Published',
            publishedAt: new Date(),
            modules: {
              create: {
                organizationId: FOREIGN_ORG,
                title: 'Optional module',
                position: 1,
                lessons: {
                  create: {
                    organizationId: FOREIGN_ORG,
                    title: 'Optional lesson',
                    content: 'Hidden content',
                    position: 1,
                    materials: {
                      create: {
                        organizationId: FOREIGN_ORG,
                        materialType: 'Video',
                        title: 'Optional video',
                        isRequired: false,
                        fileId: FOREIGN_FILE,
                        position: 1,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  });
});

after(async () => {
  try {
    await fixturePrisma.$transaction(async (tx) => {
      await tx.courseChain.deleteMany({
        where: { id: FOREIGN_CHAIN, organizationId: FOREIGN_ORG },
      });
      await tx.mediaFile.deleteMany({
        where: { id: FOREIGN_FILE, organizationId: FOREIGN_ORG },
      });
    });
  } finally {
    await fixturePrisma.$disconnect();
  }
});

interface ApiBody<T> {
  statusCode: number;
  data: T;
  error?: unknown;
  path?: string;
  timestamp?: string;
}

async function get<T>(
  path: string,
  role: 'LEARNER' | 'INSTRUCTOR' = 'LEARNER',
  organizationId = ORG_A,
): Promise<{ status: number; body: ApiBody<T> }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'x-internal-key': process.env.INTERNAL_SERVICE_KEY ?? '',
      'x-user-id': role === 'LEARNER' ? LEARNER_1 : INSTRUCTOR_1,
      'x-organization-id': organizationId,
      'x-user-role': role,
    },
  });
  return {
    status: response.status,
    body: (await response.json()) as ApiBody<T>,
  };
}

const getCatalog = (query = '', role?: 'LEARNER' | 'INSTRUCTOR') =>
  get<CatalogPageDto>(`/catalog${query}`, role);

const getIntroduction = (courseId: string, role?: 'LEARNER' | 'INSTRUCTOR') =>
  get<CourseIntroductionDto>(`/${courseId}/introduction`, role);

void describe('GET /courses/catalog (UC25)', () => {
  void test('trả đúng 4 Course seed theo published_at giảm dần; loại Archived, Private, Draft, Disabled, org B', async () => {
    const { status, body } = await getCatalog();
    assert.equal(status, 200);
    assert.deepEqual(
      body.data.items.map((course) => course.id),
      CATALOG_IDS,
    );
    assert.deepEqual(body.data.meta, {
      current: 1,
      pageSize: 12,
      pages: 1,
      total: CATALOG_TOTAL,
    });
  });

  void test('mỗi phần tử chỉ có đúng 7 trường của danh mục', async () => {
    const { body } = await getCatalog();
    assert.deepEqual(Object.keys(body.data.items[0]).sort(), [
      'coverFileId',
      'estimatedDurationMinutes',
      'expectedCompletionDays',
      'id',
      'name',
      'shortDescription',
      'trainingObjectives',
    ]);
  });

  void test(
    // Reading speed 200; mixed lesson 1 = ceil(601/60) + ceil(1001/200) = 17.
    // Each later mixed lesson = ceil(485/60) + ceil(625/200) = 13.
    // Optional video is excluded; disabled materials/lessons are excluded.
    'estimatedDurationMinutes khớp seed: version 2 = 30 + 17 + 13 + 13 = 73; ' +
      'locked = 17 + 13 + 13 = 43; disabled = 10 + ceil(750/200) = 14; no assignment = 17 + 13 = 30',
    async () => {
      const { body } = await getCatalog();
      const minutes = Object.fromEntries(
        body.data.items.map((course) => [
          course.id,
          course.estimatedDurationMinutes,
        ]),
      );
      assert.deepEqual(minutes, {
        [COURSE.publishedVersion]: 73,
        [COURSE.noAssignment]: 30,
        [COURSE.disabledMaterial]: 14,
        [COURSE.publishedLocked]: 43,
      });
    },
  );

  for (const page of ['0', 'abc', '1.5', '-1']) {
    void test(`page=${page} trả 400`, async () => {
      const { status } = await getCatalog(`?page=${page}`);
      assert.equal(status, 400);
    });
  }

  void test('page=99 vượt tổng số trang trả items rỗng, không lỗi', async () => {
    const { status, body } = await getCatalog('?page=99');
    assert.equal(status, 200);
    assert.deepEqual(body.data.items, []);
    assert.equal(body.data.meta.current, 99);
    assert.equal(body.data.meta.total, CATALOG_TOTAL);
  });

  for (const [page, current] of [
    ['1e20', 1e20],
    ['99999999999999999999999', 1e23],
  ] as const) {
    void test(`page=${page} (offset vượt int64) trả 200, items rỗng, total đúng; không còn 500`, async () => {
      const { status, body } = await getCatalog(`?page=${page}`);
      assert.equal(status, 200);
      assert.deepEqual(body.data, {
        meta: { current, pageSize: 12, pages: 1, total: CATALOG_TOTAL },
        items: [],
      });
    });
  }

  void test('trang cuối có dữ liệu trả đúng các Course như trước; trang cuối + 1 trả rỗng', async () => {
    const { body: first } = await getCatalog();
    const lastPage = first.data.meta.pages;
    assert.equal(lastPage, 1);

    const last = await getCatalog(`?page=${lastPage}`);
    assert.equal(last.status, 200);
    assert.deepEqual(
      last.body.data.items.map((course) => course.id),
      CATALOG_IDS,
    );

    const beyond = await getCatalog(`?page=${lastPage + 1}`);
    assert.equal(beyond.status, 200);
    assert.deepEqual(beyond.body.data, {
      meta: {
        current: lastPage + 1,
        pageSize: 12,
        pages: 1,
        total: CATALOG_TOTAL,
      },
      items: [],
    });
  });

  void test('tổ chức không có Course nào (E1): page=1 trả 200, items rỗng, pages 0, total 0', async () => {
    const { status, body } = await get<CatalogPageDto>(
      '/catalog?page=1',
      'LEARNER',
      EMPTY_ORG,
    );
    assert.equal(status, 200);
    assert.deepEqual(body.data, {
      meta: { current: 1, pageSize: 12, pages: 0, total: 0 },
      items: [],
    });
  });

  void test('size=50 bị bỏ qua, trang vẫn 12 Course', async () => {
    const { status, body } = await getCatalog('?page=1&size=50');
    assert.equal(status, 200);
    assert.equal(body.data.meta.pageSize, 12);
    assert.equal(body.data.items.length, CATALOG_TOTAL);
  });

  void test('q trống trả đúng danh mục UC25', async () => {
    const [blank, omitted] = await Promise.all([
      getCatalog('?q=%20%09'),
      getCatalog(),
    ]);
    assert.equal(blank.status, 200);
    assert.deepEqual(blank.body.data, omitted.body.data);
  });

  void test('q chuẩn hóa Unicode và khoảng trắng trước khi tìm', async () => {
    assert.notEqual(
      process.env.NODE_ENV,
      'production',
      'The Unicode case writes test data.',
    );
    const connectionString = process.env.DATABASE_URL;
    assert.ok(
      connectionString,
      'DATABASE_URL must point to the Course test database.',
    );

    const organizationId = `0199a000-0000-7000-8000-${randomBytes(6).toString('hex')}`;
    const title = 'An toàn lao động';
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
    try {
      const chain = await prisma.courseChain.create({
        data: {
          organizationId,
          instructorId: INSTRUCTOR_1,
          courses: {
            create: {
              organizationId,
              versionNumber: 1,
              name: title,
              learningOutcomes: [],
              expectedCompletionDays: 7,
              courseType: 'Public',
              status: 'Published',
              publishedAt: new Date(),
            },
          },
        },
        select: { id: true, courses: { select: { id: true } } },
      });
      try {
        const [course] = chain.courses;
        for (const keyword of ['AN   TOAN LAO DONG', title.normalize('NFD')]) {
          const result = await get<CatalogPageDto>(
            '/catalog?q=' + encodeURIComponent(keyword),
            'LEARNER',
            organizationId,
          );
          assert.equal(result.status, 200);
          assert.deepEqual(
            result.body.data.items.map(({ id }) => id),
            [course.id],
          );
          assert.equal(result.body.data.meta.total, 1);
        }
      } finally {
        // Deleting the isolated chain also deletes its single fixture course.
        await prisma.courseChain.delete({
          where: { id: chain.id, organizationId },
        });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  void test('q dài 201 code point hoặc lặp lại trả VALIDATION_ERROR', async () => {
    const atLimit = await getCatalog(
      '?q=' + encodeURIComponent('😀'.repeat(200)),
    );
    assert.equal(atLimit.status, 200);
    assert.equal(atLimit.body.data.meta.total, 0);
    for (const query of [
      '?q=' + encodeURIComponent('😀'.repeat(201)),
      '?q=a&q=b',
      '?q=%00',
    ]) {
      const result = await getCatalog(query);
      assert.equal(result.status, 400);
      assert.equal(
        (result.body.error as { code: string }).code,
        'VALIDATION_ERROR',
      );
    }
  });

  void test('INSTRUCTOR_1 bị từ chối 403', async () => {
    const { status } = await getCatalog('', 'INSTRUCTOR');
    assert.equal(status, 403);
  });
});

void describe('GET /courses/:courseId/introduction (UC25.1)', () => {
  void test('Course có học liệu tự chọn: cờ Module/Lesson false, số lượng 1, thời lượng 0', async () => {
    const { status, body } = await get<CourseIntroductionDto>(
      '/' + COURSE.foreign + '/introduction',
      'LEARNER',
      FOREIGN_ORG,
    );
    assert.equal(status, 200);
    assert.equal(body.data.estimatedDurationMinutes, 0);
    assert.equal(body.data.requiredMaterialCount, 0);
    assert.deepEqual(
      body.data.modules.map((module) => [module.position, module.isRequired]),
      [[1, false]],
    );
    assert.deepEqual(
      body.data.modules[0].lessons.map((lesson) => [
        lesson.position,
        lesson.isRequired,
        lesson.materialCount,
      ]),
      [[1, false, 1]],
    );
  });

  void test('version 2: cây theo position, cờ bắt buộc và số học liệu tính lúc đọc, không lộ nội dung Lesson hay tệp', async () => {
    const { status, body } = await getIntroduction(COURSE.publishedVersion);
    assert.equal(status, 200);
    const course = body.data;

    assert.equal(course.id, COURSE.publishedVersion);
    assert.equal(course.estimatedDurationMinutes, 73);
    assert.equal(course.learningOutcomes.length, 2);
    // 6 học liệu bắt buộc: 3 video + 3 reading; 3 video tự chọn không tính thời lượng.
    assert.equal(course.requiredMaterialCount, 6);

    assert.deepEqual(
      course.modules.map((m) => [m.position, m.isRequired]),
      [
        [1, true],
        [2, true],
      ],
    );

    const lessons = course.modules.flatMap((m) => m.lessons);
    assert.deepEqual(
      lessons.map((l) => [l.position, l.isRequired, l.materialCount]),
      [
        [1, true, 3],
        [2, true, 3],
        [1, true, 3],
      ],
    );

    assert.deepEqual(Object.keys(lessons[0]).sort(), [
      'id',
      'isRequired',
      'materialCount',
      'position',
      'title',
    ]);
    const json = JSON.stringify(course);
    assert.ok(!json.includes('"content"'));
    assert.ok(!json.includes('"fileId"'));
    assert.ok(!json.includes('storageKey'));
  });

  void test('Course Archived, Private, Draft, Disabled, org B và courseId không phải UUID: cùng 404, cùng statusCode và error', async () => {
    const cases = [
      COURSE.archivedVersion,
      COURSE.publishedPrivate,
      COURSE.draft,
      COURSE.disabledCourse,
      COURSE.foreign,
      'khong-phai-uuid',
    ];
    const results = await Promise.all(cases.map((id) => getIntroduction(id)));

    const expected = {
      statusCode: 404,
      error: {
        code: 'COURSE_NOT_FOUND',
        message: 'Course không tồn tại hoặc không còn trong danh mục',
      },
    };
    for (const { status, body } of results) {
      assert.equal(status, 404);
      // path và timestamp do HttpExceptionFilter thêm vào, khác nhau theo từng request
      assert.deepEqual(
        { statusCode: body.statusCode, error: body.error },
        expected,
      );
    }
  });

  void test('INSTRUCTOR_1 bị từ chối 403', async () => {
    const { status } = await getIntroduction(
      COURSE.publishedVersion,
      'INSTRUCTOR',
    );
    assert.equal(status, 403);
  });
});
