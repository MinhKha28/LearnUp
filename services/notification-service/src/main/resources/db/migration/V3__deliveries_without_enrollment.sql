-- The ledger holds the deliveries of every event this service turns into a notice, not only those about an enrollment.
-- PeerReviewAssigned (assessment-service) is about a cycle of a peer review, so its rows have no enrollment.
-- The unique key (event_id, recipient_user_id, channel) is unchanged, so a repeated event is still harmless.
ALTER TABLE enrollment_event_deliveries ALTER COLUMN enrollment_id DROP NOT NULL;
