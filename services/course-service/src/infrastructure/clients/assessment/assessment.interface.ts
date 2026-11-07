export interface AssessmentCleanupResponse {
  courseId: string;
  deleted: boolean;
  deletedCount: number;
  deletedQuizCount: number;
  deletedAssignmentCount: number;
}

export interface AssessmentApiResponse<T> {
  data?: T;
}
