import { isUUID } from 'class-validator';
import { CourseServiceContractError } from './course-service.errors';
import type {
  CourseTree,
  CourseTreeLesson,
  CourseTreeMaterial,
  CourseTreeModule,
  LockedCourse,
} from './course-service.interface';

type Json = Record<string, unknown>;

/** Kiểm từng trường theo ràng buộc của bảng bản sao (D16); sai thì ném lỗi nêu rõ trường. */
class ContractReader {
  constructor(private readonly endpoint: string) {}

  fail(field: string, reason: string): never {
    throw new CourseServiceContractError(this.endpoint, field, reason);
  }

  object(value: unknown, field: string): Json {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      this.fail(field, 'phải là object');
    }
    return value as Json;
  }

  array(value: unknown, field: string): unknown[] {
    if (!Array.isArray(value)) {
      this.fail(field, 'phải là mảng');
    }
    return value;
  }

  uuid(value: unknown, field: string): string {
    if (typeof value !== 'string' || !isUUID(value, 'all')) {
      this.fail(field, 'phải là UUID');
    }
    return value;
  }

  string(value: unknown, field: string): string {
    if (typeof value !== 'string') {
      this.fail(field, 'phải là chuỗi');
    }
    return value;
  }

  integer(value: unknown, field: string, min: number, max?: number): number {
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < min ||
      (max !== undefined && value > max)
    ) {
      this.fail(
        field,
        max === undefined
          ? `phải là số nguyên ≥ ${min}`
          : `phải là số nguyên từ ${min} đến ${max}`,
      );
    }
    return value;
  }

  boolean(value: unknown, field: string): boolean {
    if (typeof value !== 'boolean') {
      this.fail(field, 'phải là boolean');
    }
    return value;
  }

  oneOf<T extends string>(
    value: unknown,
    field: string,
    allowed: readonly T[],
  ): T {
    if (typeof value !== 'string' || !allowed.includes(value as T)) {
      this.fail(field, `phải là một trong ${allowed.join(', ')}`);
    }
    return value as T;
  }

  date(value: unknown, field: string): Date {
    const date = typeof value === 'string' ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
      this.fail(field, 'phải là thời điểm hợp lệ (chuỗi ISO 8601)');
    }
    return date;
  }

  nullableDate(value: unknown, field: string): Date | null {
    return value === null ? null : this.date(value, field);
  }

  equal<T>(value: T, expected: T, field: string): T {
    if (value !== expected) {
      this.fail(field, `không khớp giá trị đã gửi (${String(expected)})`);
    }
    return value;
  }
}

/** Kiểm và đổi kiểu response I1 (gắn Locked). */
export function parseLockedCourse(
  data: unknown,
  expected: { courseId: string; organizationId: string },
): LockedCourse {
  const r = new ContractReader('I1 lock');
  const body = r.object(data, 'data');
  return {
    courseId: r.equal(
      r.uuid(body.courseId, 'courseId'),
      expected.courseId,
      'courseId',
    ),
    organizationId: r.equal(
      r.uuid(body.organizationId, 'organizationId'),
      expected.organizationId,
      'organizationId',
    ),
    chainId: r.uuid(body.chainId, 'chainId'),
    expectedCompletionDays: r.integer(
      body.expectedCompletionDays,
      'expectedCompletionDays',
      1,
      365,
    ),
    courseType: r.oneOf(body.courseType, 'courseType', [
      'Public',
      'Private',
    ] as const),
    lockedAt: r.date(body.lockedAt, 'lockedAt'),
  };
}

/** Kiểm và đổi kiểu response I2 (cây chương trình của một phiên bản). */
export function parseCourseTree(
  data: unknown,
  expectedCourseId: string,
): CourseTree {
  const r = new ContractReader('I2 tree');
  const body = r.object(data, 'data');

  const modules = r
    .array(body.modules, 'modules')
    .map((rawModule, m): CourseTreeModule => {
      const path = `modules[${m}]`;
      const module = r.object(rawModule, path);
      return {
        id: r.uuid(module.id, `${path}.id`),
        title: r.string(module.title, `${path}.title`),
        position: r.integer(module.position, `${path}.position`, 1),
        lessons: r
          .array(module.lessons, `${path}.lessons`)
          .map((rawLesson, l): CourseTreeLesson => {
            const lessonPath = `${path}.lessons[${l}]`;
            const lesson = r.object(rawLesson, lessonPath);
            return {
              id: r.uuid(lesson.id, `${lessonPath}.id`),
              title: r.string(lesson.title, `${lessonPath}.title`),
              position: r.integer(lesson.position, `${lessonPath}.position`, 1),
              disabledAt: r.nullableDate(
                lesson.disabledAt,
                `${lessonPath}.disabledAt`,
              ),
              materials: r
                .array(lesson.materials, `${lessonPath}.materials`)
                .map((rawMaterial, x) =>
                  parseMaterial(
                    r,
                    rawMaterial,
                    `${lessonPath}.materials[${x}]`,
                  ),
                ),
            };
          }),
      };
    });

  return {
    courseId: r.equal(
      r.uuid(body.courseId, 'courseId'),
      expectedCourseId,
      'courseId',
    ),
    chainId: r.uuid(body.chainId, 'chainId'),
    versionNumber: r.integer(body.versionNumber, 'versionNumber', 1),
    disabledAt: r.nullableDate(body.disabledAt, 'disabledAt'),
    asOf: r.date(body.asOf, 'asOf'),
    modules,
  };
}

function parseMaterial(
  r: ContractReader,
  raw: unknown,
  path: string,
): CourseTreeMaterial {
  const material = r.object(raw, path);
  const materialType = r.oneOf(material.materialType, `${path}.materialType`, [
    'Video',
    'Reading',
  ] as const);

  let durationSeconds: number | null;
  if (materialType === 'Video') {
    durationSeconds = r.integer(
      material.durationSeconds,
      `${path}.durationSeconds`,
      1,
    );
  } else {
    if (
      material.durationSeconds !== null &&
      material.durationSeconds !== undefined
    ) {
      r.fail(`${path}.durationSeconds`, 'phải là null với Reading');
    }
    durationSeconds = null;
  }

  return {
    id: r.uuid(material.id, `${path}.id`),
    title: r.string(material.title, `${path}.title`),
    position: r.integer(material.position, `${path}.position`, 1),
    materialType,
    isRequired: r.boolean(material.isRequired, `${path}.isRequired`),
    durationSeconds,
    disabledAt: r.nullableDate(material.disabledAt, `${path}.disabledAt`),
  };
}
