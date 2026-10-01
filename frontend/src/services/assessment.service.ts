import axios from "@/services/axios.customize";
import type {
  IAssessmentError,
  IAssignment,
  IAssignmentList,
  ICreateAssignment,
  IUpdateAssignment,
  IUpdatePeerReview,
} from "@/types/assessment.types";

// TẠM THỜI (giống course.service.ts): gateway chưa gắn được danh tính nên tự gửi các header dưới đây.
// Mặc định trùng danh tính mà course.service.ts dùng khi tạo Course, để qua được kiểm tra người phụ trách (BR-79).
// Muốn dùng dữ liệu seed (npm run db:seed) thì đặt VITE_DEV_USER_ID / VITE_DEV_ORGANIZATION_ID trong .env.development.local.
// Gỡ bỏ khi gateway tự gắn các header này.
const devHeaders = {
  "x-internal-key":
    import.meta.env.VITE_DEV_INTERNAL_KEY ?? "learnup-internal-secret",
  "x-user-id":
    import.meta.env.VITE_DEV_USER_ID ?? "33333333-3333-7333-8333-333333333333",
  "x-organization-id":
    import.meta.env.VITE_DEV_ORGANIZATION_ID ??
    "22222222-2222-7222-8222-222222222222",
  "x-user-role": import.meta.env.VITE_DEV_USER_ROLE ?? "INSTRUCTOR",
};

// Assessment Service chạy cổng riêng (8086) khi chưa có gateway. Để trống thì dùng chung VITE_BACKEND_URL như các service khác.
const requestConfig = {
  baseURL: import.meta.env.VITE_ASSESSMENT_BACKEND_URL || undefined,
  headers: devHeaders,
};

/** DEV ONLY: mock course ids are slugs, the API needs a real Course UUID. */
export const toApiCourseId = (courseId: string) =>
  import.meta.env.DEV && import.meta.env.VITE_DEV_COURSE_ID
    ? import.meta.env.VITE_DEV_COURSE_ID
    : courseId;

/** UC19 — List Assignments of a Course. */
export const fetchAssignmentsAPI = (courseId: string) =>
  axios.get<IBackendRes<IAssignmentList>>("/api/v1/assessments/assignments", {
    ...requestConfig,
    params: { courseId: toApiCourseId(courseId) },
  });

/** UC19.1 — View Assignment detail. */
export const fetchAssignmentAPI = (assignmentId: string) =>
  axios.get<IBackendRes<IAssignment>>(
    `/api/v1/assessments/assignments/${assignmentId}`,
    requestConfig,
  );

/** UC19.2 — Create Assignment. */
export const createAssignmentAPI = (payload: ICreateAssignment) =>
  axios.post<IBackendRes<IAssignment>>(
    "/api/v1/assessments/assignments",
    payload,
    requestConfig,
  );

/** UC19.3 — Update Assignment. */
export const updateAssignmentAPI = (
  assignmentId: string,
  payload: IUpdateAssignment,
) =>
  axios.patch<IBackendRes<IAssignment>>(
    `/api/v1/assessments/assignments/${assignmentId}`,
    payload,
    requestConfig,
  );

/** UC19.4 — Delete Assignment. */
export const deleteAssignmentAPI = (assignmentId: string) =>
  axios.delete<IBackendRes<{ id: string }>>(
    `/api/v1/assessments/assignments/${assignmentId}`,
    requestConfig,
  );

/** UC19.5 — Configure Peer Review. */
export const updatePeerReviewAPI = (
  assignmentId: string,
  payload: IUpdatePeerReview,
) =>
  axios.put<IBackendRes<IAssignment>>(
    `/api/v1/assessments/assignments/${assignmentId}/peer-review`,
    payload,
    requestConfig,
  );

/** The axios interceptor resolves error responses instead of rejecting; pull the message out of them. */
export const assessmentErrorText = (res: unknown, fallback: string): string => {
  const { error, message } = res as IAssessmentError;
  const raw = typeof error === "object" ? error?.message : (error ?? message);
  return (Array.isArray(raw) ? raw.join(" ") : raw) || fallback;
};
