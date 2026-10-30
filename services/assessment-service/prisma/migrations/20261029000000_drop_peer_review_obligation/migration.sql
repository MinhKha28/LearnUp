-- D10: "owes a peer review" is read from the review rows (peerReviewOf), so nothing writes or reads this column any more.
ALTER TABLE "learner_assessment_states" DROP COLUMN "peer_review_obligation";
