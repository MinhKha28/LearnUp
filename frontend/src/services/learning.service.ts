import { API_PATHS, apiGet, apiPost } from "@/services/api.client";
import type {
  CreatedEnrollment,
  CurriculumData,
  EnrolledCourseLink,
  LessonDetailData,
  MyEnrollmentsPage,
  WithdrawalResult,
} from "@/types/learning.types";

export const fetchEnrolledCourseLinks = (signal?: AbortSignal) =>
  apiGet<EnrolledCourseLink[]>(API_PATHS.myCourseIds, { signal });

export const enrollOptionalCourse = (courseId: string) =>
  apiPost<CreatedEnrollment>(API_PATHS.enroll, { courseId });

export const withdrawOptionalCourse = (enrollmentId: string) =>
  apiPost<WithdrawalResult>(API_PATHS.withdrawal(enrollmentId), undefined);

export const fetchMyEnrollments = (page: number, signal?: AbortSignal) =>
  apiGet<MyEnrollmentsPage>(API_PATHS.myEnrollments, { params: { page }, signal });

export const fetchCurriculum = (enrollmentId: string, signal?: AbortSignal) =>
  apiGet<CurriculumData>(API_PATHS.curriculum(enrollmentId), { signal });

export const fetchLessonDetail = (enrollmentId: string, lessonId: string, signal?: AbortSignal) =>
  apiGet<LessonDetailData>(API_PATHS.lesson(enrollmentId, lessonId), { signal });
