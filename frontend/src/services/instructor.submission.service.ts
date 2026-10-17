import { assessmentAxios } from "@/services/axios.customize";
import type {
  IInstructorReviewPayload,
  IInstructorReviewResult,
  ISubmissionDetail,
  ISubmissionList,
  ISubmissionListQuery,
} from "@/types/submission.types";

export const getAssignmentSubmissionsAPI = (
  assessmentId: string,
  query: ISubmissionListQuery,
) =>
  assessmentAxios.get<IBackendRes<ISubmissionList>>(
    `/api/v1/assessments/assignments/${encodeURIComponent(assessmentId)}/submissions`,
    { params: query },
  );

export const getSubmissionDetailAPI = (submissionId: string) =>
  assessmentAxios.get<IBackendRes<ISubmissionDetail>>(
    `/api/v1/assessments/submissions/${encodeURIComponent(submissionId)}`,
  );

export const gradeSubmissionAPI = (
  submissionId: string,
  payload: IInstructorReviewPayload,
) =>
  assessmentAxios.post<IBackendRes<IInstructorReviewResult>>(
    `/api/v1/assessments/submissions/${encodeURIComponent(submissionId)}/instructor-review`,
    payload,
  );
