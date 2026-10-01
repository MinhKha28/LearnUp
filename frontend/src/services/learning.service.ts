import { API_PATHS, apiGet, apiPost } from "@/services/api.client";
import type { CreatedEnrollment, EnrolledCourseLink, MyEnrollmentsPage } from "@/types/learning.types";

export const fetchEnrolledCourseLinks = (signal?: AbortSignal) =>
  apiGet<EnrolledCourseLink[]>(API_PATHS.myCourseIds, { signal });

export const enrollOptionalCourse = (courseId: string) =>
  apiPost<CreatedEnrollment>(API_PATHS.enroll, { courseId });

export const fetchMyEnrollments = (page: number, signal?: AbortSignal) =>
  apiGet<MyEnrollmentsPage>(API_PATHS.myEnrollments, { params: { page }, signal });
