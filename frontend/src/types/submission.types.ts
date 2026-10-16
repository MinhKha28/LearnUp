export interface ISubmissionPerson {
  id: string;
  fullName: string | null;
  email: string | null;
  status: string | null;
}

export interface ISubmissionListItem {
  id: string;
  learner: ISubmissionPerson;
  submissionNumber: number;
  submittedAt: string;
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

export interface ISubmissionListQuery {
  status?: string;
  q?: string;
  latestOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface IAttachedFile {
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  url: string | null;
}

export interface ISubmissionDetail {
  id: string;
  learner: ISubmissionPerson;
  submissionNumber: number;
  submittedAt: string;
  isLatest: boolean;
  content: string | null;
  file: IAttachedFile | null;
  gradingStatus: string;
  interventionReason: string | null;
  finalScore: number | null;
  finalizationComment: string | null;
  finalizedAt: string | null;
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
  reviews: {
    id: string;
    reviewer: ISubmissionPerson;
    reviewerRole: string;
    status: string;
    score: number | null;
    comment: string | null;
    completedAt: string | null;
    scores: { criterionId: string; points: number }[];
  }[];
  history: {
    id: string;
    submissionNumber: number;
    submittedAt: string;
    gradingStatus: string;
    finalScore: number | null;
  }[];
}
