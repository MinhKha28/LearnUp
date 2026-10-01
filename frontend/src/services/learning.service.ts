import { API_PATHS, apiGet, apiPost } from "@/services/api.client";
import type { CreatedEnrollment, EnrolledCourseLink } from "@/types/learning.types";

export const fetchEnrolledCourseLinks = (signal?: AbortSignal) =>
  apiGet<EnrolledCourseLink[]>(API_PATHS.myCourseIds, { signal });

export const enrollOptionalCourse = (courseId: string) =>
  apiPost<CreatedEnrollment>(API_PATHS.enroll, { courseId });
