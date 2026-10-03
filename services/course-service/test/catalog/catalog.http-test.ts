/**
 * Test HTTP cho UC25 (danh mục) và UC25.1 (giới thiệu Course) trên dữ liệu seed.
 * Chỉ gửi GET, không ghi dữ liệu. Cần course-service đang chạy và đã chạy npm run db:seed.
 *
 * Chạy: npm run test:catalog:http
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { CatalogPageDto } from 'src/modules/catalog/dto/catalog-page.dto';
import type { CourseIntroductionDto } from 'src/modules/catalog/dto/course-introduction.dto';

const BASE_URL = `${process.env.COURSE_SERVICE_URL ?? `http://localhost:${process.env.PORT ?? 8083}`}/api/v1/courses`;

const ORG_A = '0199a000-0000-7000-8000-0a0000000001';
const LEARNER_1 = '0199a000-0000-7000-8000-0b0000000001';
const INSTRUCTOR_1 = '0199a000-0000-7000-8000-0c0000000001';
/** Tổ chức không có Course nào (dùng chung với test:catalog:db, chỉ tồn tại trong transaction đã rollback). */
const EMPTY_ORG = '0199a000-0000-7000-8000-0a00000000f1';

const COURSE = {
  anToanV1Archived: '0199a000-0000-7000-8000-0e0000000001',
  anToanV2: '0199a000-0000-7000-8000-0e0000000002',
  baoMat: '0199a000-0000-7000-8000-0e0000000003',
  quyTrinhPrivate: '0199a000-0000-7000-8000-0e0000000004',
  giaoTiepDraft: '0199a000-0000-7000-8000-0e0000000005',
  nhapMonOrgB: '0199a000-0000-7000-8000-0e0000000006',
};

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
  void test('trả đúng 0e…02 rồi 0e…03 theo published_at giảm dần; loại Archived, Private, Draft, org B', async () => {
    const { status, body } = await getCatalog();
    assert.equal(status, 200);
    assert.deepEqual(
      body.data.items.map((course) => course.id),
      [COURSE.anToanV2, COURSE.baoMat],
    );
    assert.deepEqual(body.data.meta, {
      current: 1,
      pageSize: 12,
      pages: 1,
      total: 2,
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
    'estimatedDurationMinutes khớp phép tính tay từ seed (tốc độ đọc 200, assignment_minutes = 0): ' +
      '0e…02 = ⌈600/60⌉ 10 + ⌈900/60⌉ 15 + ⌈1080/60⌉ 18 + ⌈1200/200⌉ 6 + ⌈800/200⌉ 4 + ⌈1500/200⌉ 8 = 61; ' +
      '0e…03 = ⌈480/60⌉ 8 + ⌈720/60⌉ 12 + ⌈900/200⌉ 5 + ⌈1100/200⌉ 6 = 31',
    async () => {
      const { body } = await getCatalog();
      const minutes = Object.fromEntries(
        body.data.items.map((course) => [
          course.id,
          course.estimatedDurationMinutes,
        ]),
      );
      assert.deepEqual(minutes, {
        [COURSE.anToanV2]: 61,
        [COURSE.baoMat]: 31,
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
    assert.equal(body.data.meta.total, 2);
  });

  for (const [page, current] of [
    ['1e20', 1e20],
    ['99999999999999999999999', 1e23],
  ] as const) {
    void test(`page=${page} (offset vượt int64) trả 200, items rỗng, total đúng; không còn 500`, async () => {
      const { status, body } = await getCatalog(`?page=${page}`);
      assert.equal(status, 200);
      assert.deepEqual(body.data, {
        meta: { current, pageSize: 12, pages: 1, total: 2 },
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
      [COURSE.anToanV2, COURSE.baoMat],
    );

    const beyond = await getCatalog(`?page=${lastPage + 1}`);
    assert.equal(beyond.status, 200);
    assert.deepEqual(beyond.body.data, {
      meta: { current: lastPage + 1, pageSize: 12, pages: 1, total: 2 },
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
    assert.equal(body.data.items.length, 2);
  });

  void test('INSTRUCTOR_1 bị từ chối 403', async () => {
    const { status } = await getCatalog('', 'INSTRUCTOR');
    assert.equal(status, 403);
  });
});

void describe('GET /courses/:courseId/introduction (UC25.1)', () => {
  void test('0e…02: cây theo position, cờ bắt buộc và số học liệu tính lúc đọc, không lộ nội dung Lesson hay tệp', async () => {
    const { status, body } = await getIntroduction(COURSE.anToanV2);
    assert.equal(status, 200);
    const course = body.data;

    assert.equal(course.id, COURSE.anToanV2);
    assert.equal(course.estimatedDurationMinutes, 61);
    assert.equal(course.learningOutcomes.length, 4);
    // 6 học liệu bắt buộc: 3 video + 3 reading (xem phép tính 61 phút)
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
        [1, true, 2],
        [2, true, 1],
        [1, true, 2],
        [2, true, 3],
        // "Tài liệu tham khảo thêm": chỉ có học liệu không bắt buộc
        [3, false, 1],
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

  void test('Course Archived, Private, Draft, org B và courseId không phải UUID: cùng 404, cùng statusCode và error', async () => {
    const cases = [
      COURSE.anToanV1Archived,
      COURSE.quyTrinhPrivate,
      COURSE.giaoTiepDraft,
      COURSE.nhapMonOrgB,
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
    const { status } = await getIntroduction(COURSE.anToanV2, 'INSTRUCTOR');
    assert.equal(status, 403);
  });
});
