# Assessment status events

Producer: assessment-service. Consumer: learning-service, default group
`learning-assessment-status-v1`. Topic: `learnup.assessment.learner-assessment-events`.
Key: learnerId. Envelope: [v1](event-envelope.schema.json), with occurredAt at its root.
Event type: `LearnerAssessmentStatusChanged`.

Payload fields: assessmentId, learnerId, courseId (UUIDs), kind (QUIZ or ASSIGNMENT),
status (Started, Submitted, Resubmitted, PeerReviewWaived, PeerReviewCompleted,
PeerReviewAssigned, PeerReviewMissed, Finalized).
organizationId, when supplied, must match the envelope. Producer also supplies reason,
revision and nullable firstActivityAt. Missing/null firstActivityAt falls back to
envelope occurredAt for Started/Submitted/Resubmitted only. Revision is an unordered,
learner/course-scoped snapshot hash; Learning neither orders nor stores it.

`Started` is sent when a Learner starts a Quiz attempt (UC29.1, BR-201: the attempt is learning data from that moment),
with reason `QUIZ_STARTED`, kind `QUIZ` and extra fields attemptId, attemptNumber, consecutiveCount, deadlineAt.

Learning does not read, validate, or store these four `Started` extras.

Started/Submitted/Resubmitted use Learning's shared earliest-activity activation helper.
PeerReviewWaived/PeerReviewCompleted/PeerReviewAssigned/PeerReviewMissed/Finalized never activate.
The additive status values below are accepted by learning. Assessment emits them from the paths listed:

| Status | Reason | Assessment path | Extra fields |
| --- | --- | --- | --- |
| PeerReviewAssigned | PEER_REVIEW_ASSIGNED | a peer review cycle closes (`closeOpen`, by the schedule or by the Instructor) | `cycleId`, `reviewCount` |
| PeerReviewMissed | PEER_REVIEW_MISSED | the review deadline of a cycle passes and reviews were not done (schedule) | `cycleId`, `missedCount` |
| Finalized | ASSIGNMENT_FINALIZED | the Instructor finalizes a submission (UC32.3) | `submissionId`, `finalScore`, `finalizedAt` |

`PeerReviewAssigned` and `PeerReviewMissed` are written once for each Learner who got reviews to give, or who left some
undone, in the same transaction that creates the reviews or marks them Missed (so the event exists if and only if the
change does), with `kind` `ASSIGNMENT`, `occurredAt` the time of the closing or of the deadline check, and the key
`learnerId`. A cycle that goes to the Instructor (too few submissions) writes none; a Learner who gave every review of a
cycle gets no `PeerReviewMissed`. `revision` is the revision of the completion snapshot after the change, so the
Learner's peer review duty is `Pending` (after `PeerReviewAssigned`) or `Missed` (after `PeerReviewMissed`) in the
snapshot that learning reads. Learning ignores `cycleId`, `reviewCount` and `missedCount`.
This is not the notification event `PeerReviewAssigned` of [assessment-peer-review-events.md](assessment-peer-review-events.md),
which has its own topic and consumer.

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
