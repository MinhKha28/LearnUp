import type { Prisma } from '../../../generated/prisma/client';
import type {
  CourseTree,
  LockedCourse,
} from '../../infrastructure/clients/course/course-service.interface';

/** Các dòng bản sao một phiên bản Course, ghi trong transaction tạo Enrollment (thiết kế mục 3.4–3.6). */
export interface CourseSnapshotRows {
  course: Prisma.CourseVersionSnapshotCreateManyInput;
  materials: Prisma.MaterialSnapshotCreateManyInput[];
  /** Chỉ Lesson đang bị vô hiệu hóa (bảng thưa). */
  lessons: Prisma.LessonSnapshotCreateManyInput[];
}

/**
 * Dựng bản sao từ kết quả I1 (chain_id) và I2 (cây, asOf).
 * Mọi cột *_as_of lấy asOf của I2; duration chỉ có với Video.
 */
export function buildCourseSnapshotRows(
  lock: LockedCourse,
  tree: CourseTree,
  fetchedAt: Date,
): CourseSnapshotRows {
  const { organizationId } = lock;
  const { courseId, asOf } = tree;
  const lessons = tree.modules.flatMap((module) => module.lessons);

  return {
    course: {
      courseId,
      organizationId,
      chainId: lock.chainId,
      treeFetchedAt: fetchedAt,
      disabledAt: tree.disabledAt,
      disabledAsOf: asOf,
    },
    materials: lessons.flatMap((lesson) =>
      lesson.materials.map((material) => {
        const isVideo = material.materialType === 'Video';
        return {
          materialId: material.id,
          organizationId,
          courseId,
          lessonId: lesson.id,
          materialType: material.materialType,
          isRequired: material.isRequired,
          durationSeconds: isVideo ? material.durationSeconds : null,
          durationAsOf: isVideo ? asOf : null,
          disabledAt: material.disabledAt,
          disabledAsOf: asOf,
        };
      }),
    ),
    lessons: lessons
      .filter((lesson) => lesson.disabledAt !== null)
      .map((lesson) => ({
        lessonId: lesson.id,
        organizationId,
        courseId,
        disabledAt: lesson.disabledAt,
        disabledAsOf: asOf,
      })),
  };
}
