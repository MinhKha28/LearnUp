import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildCourseSnapshotRows } from '../../src/modules/course-snapshots/course-snapshot-rows';
import type {
  CourseTree,
  LockedCourse,
} from '../../src/infrastructure/clients/course/course-service.interface';

const ORG_A = '0199a000-0000-7000-8000-0a0000000001';
const COURSE_ID = '0199a000-0000-7000-8000-0e0000000003';
const ASOF = new Date('2026-10-01T01:00:00Z');
const FETCHED_AT = new Date('2026-10-01T01:00:05Z');
const DISABLED = new Date('2026-09-01T00:00:00Z');

const LOCK: LockedCourse = {
  courseId: COURSE_ID,
  organizationId: ORG_A,
  chainId: '0199a000-0000-7000-8000-0d0000000002',
  expectedCompletionDays: 7,
  courseType: 'Public',
  lockedAt: new Date('2026-10-01T00:00:00Z'),
};

const material = (
  id: string,
  materialType: 'Video' | 'Reading',
  disabledAt: Date | null = null,
) => ({
  id,
  title: id,
  position: 1,
  materialType,
  isRequired: true,
  durationSeconds: materialType === 'Video' ? 120 : null,
  disabledAt,
});

const TREE: CourseTree = {
  courseId: COURSE_ID,
  chainId: LOCK.chainId,
  versionNumber: 1,
  disabledAt: null,
  asOf: ASOF,
  modules: [
    {
      id: 'm1',
      title: 'M1',
      position: 1,
      lessons: [
        {
          id: 'l1',
          title: 'L1',
          position: 1,
          disabledAt: null,
          materials: [material('x1', 'Video'), material('x2', 'Reading')],
        },
        {
          id: 'l2',
          title: 'L2',
          position: 2,
          disabledAt: DISABLED,
          materials: [material('x3', 'Video', DISABLED)],
        },
      ],
    },
    {
      id: 'm2',
      title: 'M2',
      position: 2,
      lessons: [
        {
          id: 'l3',
          title: 'L3',
          position: 1,
          disabledAt: null,
          materials: [material('x4', 'Reading')],
        },
      ],
    },
  ],
};

void describe('buildCourseSnapshotRows', () => {
  const rows = buildCourseSnapshotRows(LOCK, TREE, FETCHED_AT);

  void test('course_version_snapshots: chain_id từ I1, tree_fetched_at = lúc lấy, disabled_as_of = asOf', () => {
    assert.deepEqual(rows.course, {
      courseId: COURSE_ID,
      organizationId: ORG_A,
      chainId: LOCK.chainId,
      treeFetchedAt: FETCHED_AT,
      disabledAt: null,
      disabledAsOf: ASOF,
    });
  });

  void test('material_snapshots: đủ mọi học liệu, duration chỉ với Video', () => {
    assert.deepEqual(
      rows.materials.map((m) => [
        m.materialId,
        m.lessonId,
        m.durationSeconds,
        m.durationAsOf,
        m.disabledAt,
        m.disabledAsOf,
      ]),
      [
        ['x1', 'l1', 120, ASOF, null, ASOF],
        ['x2', 'l1', null, null, null, ASOF],
        ['x3', 'l2', 120, ASOF, DISABLED, ASOF],
        ['x4', 'l3', null, null, null, ASOF],
      ],
    );
  });

  void test('lesson_snapshots: chỉ Lesson có disabledAt', () => {
    assert.deepEqual(rows.lessons, [
      {
        lessonId: 'l2',
        organizationId: ORG_A,
        courseId: COURSE_ID,
        disabledAt: DISABLED,
        disabledAsOf: ASOF,
      },
    ]);
  });
});
