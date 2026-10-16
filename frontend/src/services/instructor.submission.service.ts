import { assessmentAxios } from "@/services/axios.customize";
import type {
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
