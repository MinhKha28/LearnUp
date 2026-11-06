# Assessment status events

Producer: assessment-service. Consumer: learning-service, default group
`learning-assessment-status-v1`. Topic: `learnup.assessment.learner-assessment-events`.
Key: learnerId. Envelope: [v1](event-envelope.schema.json), with occurredAt at its root.
Event type: `LearnerAssessmentStatusChanged`.

Payload fields: assessmentId, learnerId, courseId (UUIDs), kind (QUIZ or ASSIGNMENT),
status (Submitted, Resubmitted, PeerReviewWaived, PeerReviewCompleted,
PeerReviewAssigned, PeerReviewMissed, Finalized).
organizationId, when supplied, must match the envelope. Producer also supplies reason,
revision and nullable firstActivityAt. Missing/null firstActivityAt falls back to
envelope occurredAt for Submitted/Resubmitted only. Revision is an unordered,
learner/course-scoped snapshot hash; Learning neither orders nor stores it.

Submitted/Resubmitted use Learning's shared earliest-activity activation helper.
PeerReviewWaived/PeerReviewCompleted/PeerReviewAssigned/PeerReviewMissed/Finalized never activate.
The additive status values below are accepted by learning and are planned for
the Assessment paths listed below (not yet emitted):

| Status | Reason | Assessment path |
| --- | --- | --- |
| PeerReviewAssigned | PEER_REVIEW_ASSIGNED | close (`closeOpen`) |
| PeerReviewMissed | PEER_REVIEW_MISSED | expire |
| Finalized | ASSIGNMENT_FINALIZED | separate finalization publish action (UC32.3) |

Deploy the accepting Learning consumer before Assessment starts emitting these values.
`Finalized` requires reason `ASSIGNMENT_FINALIZED`; a missing or wrong reason is
quarantined as `INVALID_PAYLOAD`, as are unknown statuses. For other statuses,
Learning checks the type of `reason` when supplied without enforcing pairs.
Assessment's finalization event carries `submissionId`, `finalScore`, and
`finalizedAt`. Learning does not read, validate, persist, or log these extra fields
on accepted events: missing or malformed values do not cause quarantine. Learning
uses its own completion rules and fresh REST snapshot, never the event's score.
Every valid event matching an
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
