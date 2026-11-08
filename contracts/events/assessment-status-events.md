# Assessment status events

Producer: assessment-service. Consumer: learning-service, default group
`learning-assessment-status-v1`. Topic: `learnup.assessment.learner-assessment-events`.
Key: learnerId. Envelope: [v1](event-envelope.schema.json), with occurredAt at its root.
Event type: `LearnerAssessmentStatusChanged`.

Payload fields: assessmentId, learnerId, courseId (UUIDs), kind (QUIZ or ASSIGNMENT),
status (Submitted, Resubmitted, PeerReviewWaived, PeerReviewCompleted).
organizationId, when supplied, must match the envelope. Producer also supplies reason,
revision and nullable firstActivityAt. Missing/null firstActivityAt falls back to
envelope occurredAt for Submitted/Resubmitted only. Revision is an unordered,
learner/course-scoped snapshot hash; Learning neither orders nor stores it.

Submitted/Resubmitted use Learning's shared earliest-activity activation helper.
PeerReviewWaived/PeerReviewCompleted never activate. Every valid event matching an
Enrollment queues completion re-evaluation in the same database transaction, with
source `assessment`. The existing worker fetches fresh assessment facts over REST;
it evaluates NotStarted/InProgress/Exempted and skips Completed/Halted/Withdrawn.
No consumer-specific enrollment status filtering or receipt table is introduced.
Duplicate events may advance the coalesced queue generation; state effects are repeat-safe.

Invalid envelopes/payloads, missing courseId and unmatched Enrollments are durably
stored in `assessment_event_quarantine` before acknowledging the delivery. Offset
commits follow database commits. Database failures leave deliveries unacknowledged.
Quarantine uniqueness is topic/partition/offset; duplicate deliveries do not add rows.
Logs contain reason and delivery coordinates only. Operators can inspect quarantine
and replay corrected events after resolving the cause; no automatic expiry applies.
Consumer topic auto-creation is disabled. Startup retries tolerate broker/topic absence.
