export interface IFinalizeSubmissionResult {
  submissionId: string;
  gradingStatus: 'Finalized';
  finalScore: number;
  finalizationComment: string | null;
  finalizedAt: string;
}
