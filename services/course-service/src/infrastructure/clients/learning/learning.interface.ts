export interface CourseLearnerCount {
  courseId: string;
  learnerCount: number;
}

export interface LearningApiResponse<T> {
  data?: T;
}
