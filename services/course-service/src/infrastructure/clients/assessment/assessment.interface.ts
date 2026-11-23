export interface QuizSummary {
  id: string;
  questionCount: number;
}

export interface QuizListResponse {
  items: QuizSummary[];
  meta: {
    total: number;
  };
}

export interface ApiResponse<T> {
  data?: T;
}

export interface AssessmentCleanupResponse {
  courseId: string;
  deleted: boolean;
  deletedCount: number;
  deletedQuizCount: number;
  deletedAssignmentCount: number;
}
