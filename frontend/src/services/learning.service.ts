import { API_PATHS, apiGet, apiPost } from "@/services/api.client";
import { apiRequestUrl } from "@/services/api.client";
import { ApiError } from "@/types/api.types";
import type { VideoPlayback, VideoProgress } from "@/types/learning.types";

const videoPath = (enrollmentId: string, materialId: string) =>
  `/api/v1/enrollments/${encodeURIComponent(enrollmentId)}/materials/${encodeURIComponent(materialId)}`;
export const fetchVideoPlayback = (
  enrollmentId: string,
  materialId: string,
  signal?: AbortSignal,
) =>
  apiGet<VideoPlayback>(`${videoPath(enrollmentId, materialId)}/playback`, {
    signal,
  });
export const reportVideoProgress = async (
  enrollmentId: string,
  materialId: string,
  ranges: [number, number][],
  keepalive = false,
): Promise<VideoProgress> => {
  const token = localStorage.getItem("access_token");
  let response: Response;
  try {
    response = await fetch(
      apiRequestUrl(`${videoPath(enrollmentId, materialId)}/progress`),
      {
        method: "POST",
        keepalive,
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ranges }),
      },
    );
  } catch {
    throw new ApiError(0, "NETWORK", "");
  }
  const body = await response.json();
  if (!response.ok)
    throw new ApiError(response.status, body.error?.code ?? "HTTP_ERROR", "", {
      details: body.error?.details,
    });
  return body.data as VideoProgress;
};
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
  apiGet<MyEnrollmentsPage>(API_PATHS.myEnrollments, {
    params: { page },
    signal,
  });

export const fetchCurriculum = (enrollmentId: string, signal?: AbortSignal) =>
  apiGet<CurriculumData>(API_PATHS.curriculum(enrollmentId), { signal });

export const fetchLessonDetail = (
  enrollmentId: string,
  lessonId: string,
  signal?: AbortSignal,
) =>
  apiGet<LessonDetailData>(API_PATHS.lesson(enrollmentId, lessonId), {
    signal,
  });
