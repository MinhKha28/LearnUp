import type { PageResponse } from "@/types/api.types";
import type { EnrollmentStatus, EnrollmentType } from "@/utils/learner.labels";

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
  course: { name: string; versionNumber: number; coverFileId: string | null } | null;
}

export interface MyEnrollmentsPage extends PageResponse<MyEnrollmentItem> {
  /** null khi tenant lỗi hoặc trang không có Required có hạn (D24). */
  organizationTimezone: string | null;
}
