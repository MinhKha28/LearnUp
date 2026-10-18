import type { PageResponse } from "@/types/api.types";
import type {
  EnrollmentStatus,
  EnrollmentType,
  MaterialType,
} from "@/utils/learner.labels";

/** Một phần tử của GET /enrollments/me/course-ids (D20, D48). */
export interface EnrolledCourseLink {
  courseId: string;
  enrollmentId: string;
}

/** Phản hồi 201 của POST /enrollments (UC25.3). */
export interface CreatedEnrollment {
  id: string;
  courseId: string;
  enrollmentType: EnrollmentType;
  status: EnrollmentStatus;
  enrolledAt: string;
  restored: boolean;
}

export interface WithdrawalResult {
  outcome: "DELETED" | "WITHDRAWN";
}

/** Một dòng UC26 (MyEnrollmentItem của learning-service); status đã gồm Overdue (D23). */
export interface MyEnrollmentItem {
  enrollmentId: string;
  courseId: string;
  enrollmentType: EnrollmentType;
  status: EnrollmentStatus;
  dueAt: string | null;
  requiredMaterials: { completed: number; total: number };
  /** null khi course-service không trả Course này (D26). */
  course: {
    name: string;
    versionNumber: number;
    coverFileId: string | null;
  } | null;
}

export interface MyEnrollmentsPage extends PageResponse<MyEnrollmentItem> {
  /** null khi tenant lỗi hoặc trang không có Required có hạn (D24). */
  organizationTimezone: string | null;
}

/** completed null: không có học liệu hiển thị, trạng thái trung tính (D30). */
export interface CurriculumLesson {
  lessonId: string;
  title: string;
  position: number;
  isRequired: boolean;
  completed: boolean | null;
}

export interface CurriculumModule {
  moduleId: string;
  title: string;
  position: number;
  isRequired: boolean;
  completed: boolean | null;
  lessons: CurriculumLesson[];
}

/** GET /enrollments/:enrollmentId/curriculum (CurriculumView của learning-service). */
export interface CurriculumData {
  enrollmentId: string;
  courseId: string;
  enrollmentType: EnrollmentType;
  status: EnrollmentStatus;
  dueAt: string | null;
  organizationTimezone: string | null;
  requiredMaterials: { completed: number; total: number };
  course: { name: string; versionNumber: number } | null;
  modules: CurriculumModule[];
}

export interface LessonMaterial {
  materialId: string;
  title: string;
  materialType: MaterialType;
  isRequired: boolean;
  durationSeconds: number | null;
  completed: boolean;
}

export interface LessonNeighbor {
  lessonId: string;
  title: string;
}

/** GET /enrollments/:enrollmentId/lessons/:lessonId (LessonView của learning-service). */
export interface LessonDetailData {
  enrollmentId: string;
  lesson: {
    lessonId: string;
    title: string;
    content: string | null;
    isRequired: boolean;
    completed: boolean | null;
  };
  materials: LessonMaterial[];
  previousLesson: LessonNeighbor | null;
  nextLesson: LessonNeighbor | null;
}
export interface VideoProgress {
  materialId: string;
  durationSeconds: number;
  watchedRanges: [number, number][];
  watchedSeconds: number;
  requiredSeconds: number;
  completed: boolean;
  completedAt: string | null;
  maxPlaybackRate: number;
  heartbeatSeconds: number;
}
export interface VideoPlayback extends VideoProgress {
  title: string;
  playbackUrl: string;
}
