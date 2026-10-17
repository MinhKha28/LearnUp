/** The Peer Review columns UC19.5 writes on the Assignment row. */
export interface PeerReviewUpdateData {
  peerReviewEnabled: boolean;
  peerReviewersPerSubmission?: number;
  peerReviewCycleDays?: number;
  peerReviewDeadlineDays?: number;
  peerReviewScoreGap?: number;
}
