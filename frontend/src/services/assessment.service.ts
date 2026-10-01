import axios from "@/services/axios.customize";
import type {
  IAssessmentError,
  IAssignment,
  IAssignmentList,
  ICreateAssignment,
  IUpdateAssignment,
  IUpdatePeerReview,
} from "@/types/assessment.types";

/** DEV ONLY: mock course ids are slugs, the API needs a real Course UUID. */
export const toApiCourseId = (courseId: string) =>
  import.meta.env.DEV && import.meta.env.VITE_DEV_COURSE_ID ? import.meta.env.VITE_DEV_COURSE_ID : courseId;

/** UC19 — List Assignments of a Course. */
export const fetchAssignmentsAPI = (courseId: string) =>
  axios.get<IBackendRes<IAssignmentList>>("/api/v1/assessments/assignments", {
    params: { courseId: toApiCourseId(courseId) },
  });

/** UC19.1 — View Assignment detail. */
export const fetchAssignmentAPI = (assignmentId: string) =>
  axios.get<IBackendRes<IAssignment>>(`/api/v1/assessments/assignments/${assignmentId}`);

/** UC19.2 — Create Assignment. */
export const createAssignmentAPI = (payload: ICreateAssignment) =>
  axios.post<IBackendRes<IAssignment>>("/api/v1/assessments/assignments", payload);

/** UC19.3 — Update Assignment. */
export const updateAssignmentAPI = (assignmentId: string, payload: IUpdateAssignment) =>
  axios.patch<IBackendRes<IAssignment>>(`/api/v1/assessments/assignments/${assignmentId}`, payload);

/** UC19.4 — Delete Assignment. */
export const deleteAssignmentAPI = (assignmentId: string) =>
  axios.delete<IBackendRes<{ id: string }>>(`/api/v1/assessments/assignments/${assignmentId}`);

/** UC19.5 — Configure Peer Review. */
export const updatePeerReviewAPI = (assignmentId: string, payload: IUpdatePeerReview) =>
  axios.put<IBackendRes<IAssignment>>(`/api/v1/assessments/assignments/${assignmentId}/peer-review`, payload);

/** The axios interceptor resolves error responses instead of rejecting; pull the message out of them. */
export const assessmentErrorText = (res: unknown, fallback: string): string => {
  const { error, message } = res as IAssessmentError;
  const raw = typeof error === "object" ? error?.message : (error ?? message);
  return (Array.isArray(raw) ? raw.join(" ") : raw) || fallback;
};
