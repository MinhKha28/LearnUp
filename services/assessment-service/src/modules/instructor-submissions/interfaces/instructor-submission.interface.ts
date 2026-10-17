export interface ILearnerSummary {
  id: string;
  fullName: string | null;
  email: string | null;
  status: string | null;
}

export interface ISubmissionListItem {
  id: string;
  learner: ILearnerSummary;
  submissionNumber: number;
  submittedAt: Date;
  isLatest: boolean;
  gradingStatus: string;
  interventionReason: string | null;
  finalScore: number | null;
  reviews: { completed: number; total: number };
}

export interface ISubmissionList {
  assignment: {
    id: string;
    courseId: string;
    title: string;
    peerReviewEnabled: boolean;
  };
  statusCounts: Record<string, number>;
  learnerNamesAvailable: boolean;
  items: ISubmissionListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface IAttachedFile {
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  url: string | null;
}

export interface ISubmissionReviewView {
  id: string;
  reviewer: ILearnerSummary;
  reviewerRole: string;
  status: string;
  score: number | null;
  comment: string | null;
  completedAt: Date | null;
  scores: { criterionId: string; points: number }[];
}

export interface ISubmissionDetail {
  id: string;
  learner: ILearnerSummary;
  submissionNumber: number;
  submittedAt: Date;
  isLatest: boolean;
  content: string | null;
  file: IAttachedFile | null;
  gradingStatus: string;
  interventionReason: string | null;
  finalScore: number | null;
  finalizationComment: string | null;
  finalizedAt: Date | null;
  assignment: {
    id: string;
    courseId: string;
    title: string;
    prompt: string | null;
    promptFile: IAttachedFile | null;
    passingScore: number;
    peerReviewEnabled: boolean;
    rubric: {
      id: string;
      name: string;
      description: string;
      maxPoints: number;
      position: number;
    }[];
  };
  reviews: ISubmissionReviewView[];
  history: {
    id: string;
    submissionNumber: number;
    submittedAt: Date;
    gradingStatus: string;
    finalScore: number | null;
  }[];
}
