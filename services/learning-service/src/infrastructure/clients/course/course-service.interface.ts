/**
 * Kiểu dữ liệu của REST nội bộ course-service (internal-courses), chép từ các DTO bên đó.
 * Thời điểm được đổi từ chuỗi ISO sang Date khi nhận.
 */

/** I1: POST /internal/courses/:courseId/lock */
export interface LockedCourse {
  courseId: string;
  organizationId: string;
  chainId: string;
  expectedCompletionDays: number;
  courseType: 'Public' | 'Private';
  lockedAt: Date;
}

export interface CourseTreeMaterial {
  id: string;
  title: string;
  position: number;
  materialType: 'Video' | 'Reading';
  isRequired: boolean;
  durationSeconds: number | null;
  disabledAt: Date | null;
}

export interface CourseTreeLesson {
  id: string;
  title: string;
  position: number;
  disabledAt: Date | null;
  materials: CourseTreeMaterial[];
}

export interface CourseTreeModule {
  id: string;
  title: string;
  position: number;
  lessons: CourseTreeLesson[];
}

/** I2: GET /internal/courses/:courseId/tree */
export interface CourseTree {
  courseId: string;
  chainId: string;
  versionNumber: number;
  disabledAt: Date | null;
  asOf: Date;
  modules: CourseTreeModule[];
}

/** I3: POST /internal/courses/batch */
export interface CourseBatchItem {
  courseId: string;
  chainId: string;
  versionNumber: number;
  name: string;
  courseType: string;
  status: string;
  coverFileId: string | null;
}

/** I4: GET /internal/courses/:courseId/lessons/:lessonId */
export interface LessonContent {
  lessonId: string;
  courseId: string;
  title: string;
  content: string;
  disabledAt: Date | null;
}
