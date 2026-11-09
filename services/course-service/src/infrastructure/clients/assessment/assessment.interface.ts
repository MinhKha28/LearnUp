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
