import { assessmentAxios as axios } from "@/services/axios.customize";
import type {
  IAssessmentError,
  IAssignment,
  IAssignmentList,
  IGradingResult,
  IClosedPeerReviewCycle,
  IPeerReviewCycleList,
  ILearnerAssessmentList,
  ILearnerAssignment,
  ISubmissionReceipt,
  IPromptFile,
  ICreateAssignment,
  IQuizList,
  IQuizDetail,
  ICreateQuizReq,
  IQuizSummary,
  IUpdateAssignment,
  IUpdatePeerReview,
  IUpdateQuizConfigReq,
} from "@/types/assessment.types";

// The identity headers (x-internal-key, x-user-id, x-organization-id, x-user-role) are set by the gateway from the JWT.
// The browser sends none of them: a build must never carry an internal key, even a default one.
// Base URL lấy từ VITE_ASSESSMENT_BACKEND_URL qua assessmentAxios.

/** DEV ONLY: mock course ids are slugs, the API needs a real Course UUID. */
export const toApiCourseId = (courseId: string) =>
  import.meta.env.DEV &&
  import.meta.env.VITE_DEV_COURSE_ID &&
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseId)
    ? import.meta.env.VITE_DEV_COURSE_ID
    : courseId;

/** UC19 — List Assignments of a Course. */
export const fetchAssignmentsAPI = (courseId: string) =>
  axios.get<IBackendRes<IAssignmentList>>("/api/v1/assessments/assignments", {
    params: { courseId: toApiCourseId(courseId) },
  });

/** UC19.1 — View Assignment detail. */
export const fetchAssignmentAPI = (assignmentId: string) =>
  axios.get<IBackendRes<IAssignment>>(
    `/api/v1/assessments/assignments/${assignmentId}`,
  );

/** UC19.2 — Create Assignment. */
export const createAssignmentAPI = (payload: ICreateAssignment) =>
  axios.post<IBackendRes<IAssignment>>(
    "/api/v1/assessments/assignments",
    payload,
  );

/** UC19.2 / UC19.3 — Upload the prompt file (one PDF, 50 MB). The result goes into `promptFile` of create/update. */
export const uploadPromptFileAPI = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return axios.post<IBackendRes<IPromptFile>>("/api/v1/assessments/assignments/prompt-file", form);
};

/**
 * UC19.2 / UC19.3 — Remove a file that was uploaded but not saved with an Assignment (cancel, replace, remove).
 * Best effort: the server keeps a file an Assignment uses, and a failure only leaves a stored file behind, so the
 * Instructor is never told about it.
 */
export const discardPromptFileAPI = async (fileKey: string): Promise<void> => {
  try {
    await axios.post("/api/v1/assessments/assignments/prompt-file/discard", { fileKey });
  } catch {
    // nothing to do
  }
};

/**
 * UC19.1 — Download the prompt file. The interceptor hands a failed response back as the body (a Blob here),
 * so only a real 200 response yields the file.
 */
export const downloadPromptFileAPI = async (assignmentId: string): Promise<Blob | null> => {
  const res = (await axios.get(`/api/v1/assessments/assignments/${assignmentId}/prompt-file`, {
    responseType: "blob",
  })) as unknown as { status?: number; data?: unknown };
  return res.status === 200 && res.data instanceof Blob ? res.data : null;
};

/** UC19.3 — Update Assignment. */
export const updateAssignmentAPI = (
  assignmentId: string,
  payload: IUpdateAssignment,
) =>
  axios.patch<IBackendRes<IAssignment>>(
    `/api/v1/assessments/assignments/${assignmentId}`,
    payload,
  );

/** UC19.4 — Delete Assignment. */
export const deleteAssignmentAPI = (assignmentId: string) =>
  axios.delete<IBackendRes<{ id: string }>>(
    `/api/v1/assessments/assignments/${assignmentId}`,
  );

/** UC19.5 — Configure Peer Review. */
export const updatePeerReviewAPI = (
  assignmentId: string,
  payload: IUpdatePeerReview,
) =>
  axios.put<IBackendRes<IAssignment>>(
    `/api/v1/assessments/assignments/${assignmentId}/peer-review`,
    payload,
  );

/** UC18 — List Quizzes of a Course, optionally of one Module. */
export const fetchQuizzesAPI = (courseId: string, moduleId?: string) =>
  axios.get<IBackendRes<IQuizList>>("/api/v1/assessments/quizzes", {
    params: { courseId: toApiCourseId(courseId), moduleId },
  });

/** UC18.1 — one Quiz with configuration, questions, answer keys and what may be changed (Instructor only). */
export const fetchQuizAPI = (quizId: string) =>
  axios.get<IBackendRes<IQuizDetail>>(`/api/v1/assessments/quizzes/${quizId}`);

/** UC18.2 — Create Quiz. */
export const createQuizAPI = (payload: ICreateQuizReq) =>
  axios.post<IBackendRes<IQuizSummary>>("/api/v1/assessments/quizzes", payload);

/** UC18.4 — Update Quiz configuration; answers with the Quiz detail and its new permissions. */
export const updateQuizConfigAPI = (quizId: string, payload: IUpdateQuizConfigReq) =>
  axios.patch<IBackendRes<IQuizDetail>>(`/api/v1/assessments/quizzes/${quizId}`, payload);

/** UC18.5 — Delete Quiz. */
export const deleteQuizAPI = (quizId: string) =>
  axios.delete<IBackendRes<{ id: string }>>(`/api/v1/assessments/quizzes/${quizId}`);

/** UC29 — the Quizzes and Assignments of an enrolled Course with status, score and tries left. */
export const fetchLearnerAssessmentsAPI = (courseId: string) =>
  axios.get<IBackendRes<ILearnerAssessmentList>>(`/api/v1/assessments/learner/courses/${courseId}/assessments`);

/** UC30 step 1 — the Assignment as the enrolled Learner reads it (prompt, Rubric, attempts left). */
export const fetchLearnerAssignmentAPI = (assignmentId: string) =>
  axios.get<IBackendRes<ILearnerAssignment>>(`/api/v1/assessments/learner/assignments/${assignmentId}`);

/** UC33 — the peer review cycles of an Assignment of the Instructor. */
export const fetchPeerReviewCyclesAPI = (assignmentId: string) =>
  axios.get<IBackendRes<IPeerReviewCycleList>>(
    `/api/v1/assessments/assignments/${assignmentId}/peer-review/cycles`,
  );

/** UC33 — close a cycle now: hand out the reviews, or send the submissions to the Instructor when there are too few. */
export const closePeerReviewCycleAPI = (assignmentId: string, cycleId: string) =>
  axios.post<IBackendRes<IClosedPeerReviewCycle>>(
    `/api/v1/assessments/assignments/${assignmentId}/peer-review/cycles/${cycleId}/close`,
  );

/** UC30.2 — the grading result of the latest submission, when it is Finalized (one request, so one check of the Enrollment). */
export const fetchLearnerResultAPI = (assignmentId: string) =>
  axios.get<IBackendRes<IGradingResult>>(`/api/v1/assessments/learner/assignments/${assignmentId}/result`);

/** UC30 — Submit an Assignment: text and/or one PDF, DOCX or ZIP (50 MB). */
export const submitAssignmentAPI = (assignmentId: string, content: string, file?: File | null) => {
  const form = new FormData();
  if (content.trim()) form.append("content", content);
  if (file) form.append("file", file);
  return axios.post<IBackendRes<ISubmissionReceipt>>(
    `/api/v1/assessments/learner/assignments/${assignmentId}/submissions`,
    form,
  );
};

/** UC30.1 - Resubmit an Assignment: replaces the previous submission; same body as UC30. */
export const resubmitAssignmentAPI = (assignmentId: string, content: string, file?: File | null) => {
  const form = new FormData();
  if (content.trim()) form.append("content", content);
  if (file) form.append("file", file);
  return axios.post<IBackendRes<ISubmissionReceipt>>(
    `/api/v1/assessments/learner/assignments/${assignmentId}/resubmissions`,
    form,
  );
};

/** The prompt file for a Learner; like UC19.1, only a real 200 response yields the file. */
export const downloadLearnerPromptFileAPI = async (assignmentId: string): Promise<Blob | null> => {
  const res = (await axios.get(`/api/v1/assessments/learner/assignments/${assignmentId}/prompt-file`, {
    responseType: "blob",
  })) as unknown as { status?: number; data?: unknown };
  return res.status === 200 && res.data instanceof Blob ? res.data : null;
};

/** Code of a failed answer and, for ASSESSMENT_LOCKED, the time the Assignment opens again. */
export const assessmentErrorCode = (res: unknown): { code?: string; lockedUntil?: string } => {
  const { error } = res as IAssessmentError;
  return typeof error === "object" ? { code: error?.code, lockedUntil: error?.lockedUntil } : {};
};

/**
 * Learner-facing text (Vietnamese) of the codes that close a screen: the server message is English. This one is for the
 * screens that have nothing of the Learner to keep (the list, the result, the form when it is opened).
 */
const LEARNER_LOCK_TEXT: Record<string, string> = {
  ENROLLMENT_NOT_ACTIVE:
    "Khóa học đã tạm dừng hoặc bạn đã rút khỏi khóa học nên không thể xem hoặc nộp bài tập. Hãy liên hệ Quản lý đào tạo nếu cần hỗ trợ.",
};

/** The same lock on the form, when the Learner has typed something: the draft stays on the page (BR-210). */
export const ENROLLMENT_NOT_ACTIVE_FORM_TEXT =
  "Khóa học đã tạm dừng hoặc bạn đã rút khỏi khóa học nên không thể nộp bài nữa. Nội dung bạn đã nhập vẫn được giữ trên trang này. Hãy liên hệ Quản lý đào tạo nếu cần hỗ trợ.";

/** The axios interceptor resolves error responses instead of rejecting; pull the message out of them. */
export const assessmentErrorText = (res: unknown, fallback: string): string => {
  const { error, message } = res as IAssessmentError;
  const code = typeof error === "object" ? error?.code : undefined;
  if (code && LEARNER_LOCK_TEXT[code]) return LEARNER_LOCK_TEXT[code];
  const raw = typeof error === "object" ? error?.message : (error ?? message);
  return (Array.isArray(raw) ? raw.join(" ") : raw) || fallback;
};
