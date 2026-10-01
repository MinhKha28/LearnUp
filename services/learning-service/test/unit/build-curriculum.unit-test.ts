import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildCurriculum,
  neighborLessons,
  type SnapshotMaterial,
} from '../../src/curriculum/build-curriculum';
import type {
  CourseTree,
  CourseTreeLesson,
  CourseTreeMaterial,
  CourseTreeModule,
} from '../../src/integrations/course-service/course-service.types';

const DISABLED = new Date('2026-09-30T00:00:00Z');

function material(
  id: string,
  overrides: Partial<CourseTreeMaterial> = {},
): CourseTreeMaterial {
  return {
    id,
    title: `Học liệu ${id}`,
    position: 1,
    materialType: 'Video',
    isRequired: true,
    durationSeconds: 300,
    disabledAt: null,
    ...overrides,
  };
}

function lesson(
  id: string,
  materials: CourseTreeMaterial[],
  overrides: Partial<CourseTreeLesson> = {},
): CourseTreeLesson {
  return {
    id,
    title: `Lesson ${id}`,
    position: 1,
    disabledAt: null,
    materials,
    ...overrides,
  };
}

function module(
  id: string,
  lessons: CourseTreeLesson[],
  position = 1,
): CourseTreeModule {
  return { id, title: `Module ${id}`, position, lessons };
}

function tree(modules: CourseTreeModule[]): CourseTree {
  return {
    courseId: 'course',
    chainId: 'chain',
    versionNumber: 1,
    disabledAt: null,
    asOf: new Date('2026-10-01T00:00:00Z'),
    modules,
  };
}

/** Bản sao khớp I2: mỗi học liệu của cây có một dòng cùng cờ bắt buộc và loại. */
function snapshotOf(
  courseTree: CourseTree,
  overrides: Record<string, Partial<SnapshotMaterial>> = {},
): SnapshotMaterial[] {
  return courseTree.modules.flatMap((m) =>
    m.lessons.flatMap((l) =>
      l.materials.map((x) => ({
        materialId: x.id,
        lessonId: l.id,
        materialType: x.materialType,
        isRequired: x.isRequired,
        disabledAt: null,
        ...overrides[x.id],
      })),
    ),
  );
}

function build(
  courseTree: CourseTree,
  options: {
    snapshot?: SnapshotMaterial[];
    disabledLessons?: string[];
    completed?: string[];
  } = {},
) {
  return buildCurriculum(
    courseTree,
    {
      materials: options.snapshot ?? snapshotOf(courseTree),
      disabledLessonIds: new Set(options.disabledLessons ?? []),
    },
    new Set(options.completed ?? []),
  );
}

const lessonOf = (result: ReturnType<typeof build>, id: string) =>
  result.visibleLessons.find((l) => l.lessonId === id);

void describe('buildCurriculum – Lesson (BR-147, BR-306, D30)', () => {
  const courseTree = tree([
    module('M1', [
      lesson('L-req', [
        material('a', { position: 1 }),
        material('b', { position: 2, isRequired: false }),
      ]),
      lesson(
        'L-opt',
        [
          material('c', { isRequired: false }),
          material('d', {
            position: 2,
            isRequired: false,
            materialType: 'Reading',
            durationSeconds: null,
          }),
        ],
        { position: 2 },
      ),
      lesson('L-empty', [], { position: 3 }),
    ]),
  ]);

  void test('Lesson bắt buộc: hoàn thành khi mọi học liệu bắt buộc hoàn thành, bỏ qua học liệu không bắt buộc', () => {
    assert.equal(lessonOf(build(courseTree), 'L-req')?.isRequired, true);
    assert.equal(lessonOf(build(courseTree), 'L-req')?.completed, false);
    assert.equal(
      lessonOf(build(courseTree, { completed: ['a'] }), 'L-req')?.completed,
      true,
    );
  });

  void test('Lesson không bắt buộc: cần mọi học liệu hiển thị hoàn thành', () => {
    const one = lessonOf(build(courseTree, { completed: ['c'] }), 'L-opt');
    assert.equal(one?.isRequired, false);
    assert.equal(one?.completed, false);
    assert.equal(
      lessonOf(build(courseTree, { completed: ['c', 'd'] }), 'L-opt')
        ?.completed,
      true,
    );
  });

  void test('Lesson không có học liệu: completed null, không bắt buộc', () => {
    const empty = lessonOf(build(courseTree), 'L-empty');
    assert.equal(empty?.completed, null);
    assert.equal(empty?.isRequired, false);
  });

  void test('tiêu đề, thời lượng (chỉ Video) từ I2; loại từ bản sao', () => {
    const result = build(courseTree, {
      snapshot: snapshotOf(courseTree, { a: { materialType: 'Reading' } }),
    });
    const [a] = lessonOf(result, 'L-req')!.materials;
    assert.equal(a.title, 'Học liệu a');
    assert.equal(a.materialType, 'Reading');
    assert.equal(a.durationSeconds, 300);
    const d = lessonOf(result, 'L-opt')!.materials[1];
    assert.equal(d.durationSeconds, null);
  });
});

void describe('buildCurriculum – Module (D30)', () => {
  void test('có Lesson bắt buộc: hoàn thành khi mọi Lesson bắt buộc hoàn thành, Lesson không bắt buộc không tính', () => {
    const courseTree = tree([
      module('M', [
        lesson('L1', [material('a')]),
        lesson('L2', [material('b', { isRequired: false })], { position: 2 }),
      ]),
    ]);
    const result = build(courseTree, { completed: ['a'] });
    assert.equal(result.modules[0].isRequired, true);
    assert.equal(result.modules[0].completed, true);
    assert.equal(build(courseTree).modules[0].completed, false);
  });

  void test('không có Lesson bắt buộc: hoàn thành khi mọi Lesson có học liệu hoàn thành; Lesson rỗng không tính', () => {
    const courseTree = tree([
      module('M', [
        lesson('L1', [material('a', { isRequired: false })]),
        lesson('L2', [material('b', { isRequired: false })], { position: 2 }),
        lesson('L3', [], { position: 3 }),
      ]),
    ]);
    assert.equal(build(courseTree).modules[0].isRequired, false);
    assert.equal(
      build(courseTree, { completed: ['a'] }).modules[0].completed,
      false,
    );
    assert.equal(
      build(courseTree, { completed: ['a', 'b'] }).modules[0].completed,
      true,
    );
  });

  void test('không Lesson nào có học liệu: completed null', () => {
    const courseTree = tree([
      module('M', [lesson('L1', []), lesson('L2', [], { position: 2 })]),
    ]);
    assert.equal(build(courseTree).modules[0].completed, null);
    assert.equal(build(courseTree).modules[0].isRequired, false);
  });
});

void describe('buildCurriculum – ẩn thành phần bị vô hiệu hóa (BR-243, D29)', () => {
  const courseTree = (lessonDisabledAt: Date | null = null) =>
    tree([
      module('M1', [
        lesson('L1', [material('a')], { disabledAt: lessonDisabledAt }),
      ]),
      module('M2', [lesson('L2', [material('b')])], 2),
    ]);

  void test('Lesson bị I2 đánh dấu → ẩn, Module hết Lesson → ẩn', () => {
    const result = build(courseTree(DISABLED));
    assert.deepEqual(
      result.modules.map((m) => m.moduleId),
      ['M2'],
    );
    assert.ok(result.treeLessonIds.has('L1'));
  });

  void test('Lesson có dòng lesson_snapshots disabled → ẩn, Module hết Lesson → ẩn', () => {
    const result = build(courseTree(), { disabledLessons: ['L1'] });
    assert.deepEqual(
      result.modules.map((m) => m.moduleId),
      ['M2'],
    );
  });

  void test('học liệu bị I2 hoặc bản sao đánh dấu → ẩn; Lesson tính lại bắt buộc và hoàn thành', () => {
    const lessonTree = tree([
      module('M', [
        lesson('L', [
          material('req', { disabledAt: DISABLED }),
          material('opt', { position: 2, isRequired: false }),
        ]),
      ]),
    ]);
    const byTree = lessonOf(build(lessonTree, { completed: ['opt'] }), 'L')!;
    assert.deepEqual(
      byTree.materials.map((m) => m.materialId),
      ['opt'],
    );
    assert.equal(byTree.isRequired, false);
    assert.equal(byTree.completed, true);

    const plain = tree([
      module('M', [
        lesson('L', [
          material('req'),
          material('opt', { position: 2, isRequired: false }),
        ]),
      ]),
    ]);
    const bySnapshot = lessonOf(
      build(plain, {
        snapshot: snapshotOf(plain, { req: { disabledAt: DISABLED } }),
      }),
      'L',
    )!;
    assert.deepEqual(
      bySnapshot.materials.map((m) => m.materialId),
      ['opt'],
    );
    assert.equal(bySnapshot.isRequired, false);
  });
});

void describe('buildCurriculum – lệch giữa I2 và bản sao (D29, BR-90)', () => {
  const courseTree = tree([
    module('M', [
      lesson('L', [material('a'), material('new', { position: 2 })]),
    ]),
  ]);

  void test('chỉ có ở I2 → không bắt buộc, chưa hoàn thành, báo onlyInTree', () => {
    const result = build(courseTree, {
      snapshot: snapshotOf(courseTree).filter((m) => m.materialId !== 'new'),
      completed: ['new'],
    });
    const added = lessonOf(result, 'L')!.materials[1];
    assert.equal(added.isRequired, false);
    assert.equal(added.completed, false);
    assert.deepEqual(result.discrepancies.onlyInTree, ['new']);
  });

  void test('chỉ có ở bản sao → bỏ qua, báo onlyInSnapshot', () => {
    const extra: SnapshotMaterial = {
      materialId: 'ghost',
      lessonId: 'L',
      materialType: 'Video',
      isRequired: true,
      disabledAt: null,
    };
    const result = build(courseTree, {
      snapshot: [...snapshotOf(courseTree), extra],
    });
    assert.deepEqual(
      lessonOf(result, 'L')!.materials.map((m) => m.materialId),
      ['a', 'new'],
    );
    assert.deepEqual(result.discrepancies.onlyInSnapshot, ['ghost']);
  });

  void test('isRequired lệch → dùng bản sao, báo requiredMismatch', () => {
    const result = build(courseTree, {
      snapshot: snapshotOf(courseTree, { a: { isRequired: false } }),
    });
    assert.equal(lessonOf(result, 'L')!.materials[0].isRequired, false);
    assert.deepEqual(result.discrepancies.requiredMismatch, ['a']);
  });
});

void describe('buildCurriculum – thứ tự và Lesson trước/sau (D32)', () => {
  // Đầu vào lộn xộn: Module 2 đứng trước, Lesson và học liệu đảo thứ tự
  const courseTree = tree([
    module(
      'M2',
      [
        lesson('L22', [material('e')], { position: 2 }),
        lesson('L21', [material('d')], { position: 1, disabledAt: DISABLED }),
        lesson('L23', [material('f')], { position: 3 }),
      ],
      2,
    ),
    module('M1', [
      lesson('L12', [material('c')], { position: 2 }),
      lesson(
        'L11',
        [material('b', { position: 2 }), material('a', { position: 1 })],
        { position: 1 },
      ),
    ]),
  ]);
  const result = build(courseTree);

  void test('sắp theo position ở mọi cấp', () => {
    assert.deepEqual(
      result.modules.map((m) => m.moduleId),
      ['M1', 'M2'],
    );
    assert.deepEqual(
      result.visibleLessons.map((l) => l.lessonId),
      ['L11', 'L12', 'L22', 'L23'],
    );
    assert.deepEqual(
      result.visibleLessons[0].materials.map((m) => m.materialId),
      ['a', 'b'],
    );
  });

  void test('trước/sau qua ranh giới Module, bỏ Lesson bị ẩn; đầu và cuối là null', () => {
    const ids = (lessonId: string) => {
      const { previous, next } = neighborLessons(result, lessonId);
      return [previous?.lessonId ?? null, next?.lessonId ?? null];
    };
    assert.deepEqual(ids('L11'), [null, 'L12']);
    assert.deepEqual(ids('L12'), ['L11', 'L22']);
    assert.deepEqual(ids('L22'), ['L12', 'L23']);
    assert.deepEqual(ids('L23'), ['L22', null]);
    assert.deepEqual(ids('L21'), [null, null]);
  });
});
