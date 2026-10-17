/** Peer Review settings of an Assignment as the API returns them (BR-183). */
export interface PeerReviewConfig {
  enabled: boolean;
  reviewersPerSubmission: number | null;
  cycleDays: number | null;
  deadlineDays: number | null;
  scoreGap: number | null;
}
