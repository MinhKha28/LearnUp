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
