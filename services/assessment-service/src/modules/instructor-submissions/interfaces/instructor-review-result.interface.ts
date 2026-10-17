export interface IInstructorReviewResult {
  submissionId: string;
  gradingStatus: string;
  review: {
    id: string;
    score: number;
    comment: string | null;
    completedAt: Date;
    scores: { criterionId: string; points: number }[];
  };
  validReviewCount: number;
  suggestedScore: number;
}
