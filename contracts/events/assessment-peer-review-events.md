# Assessment peer review events

Producer: assessment-service (outbox relay). Consumer: notification-service, group
`notification-enrollment-events-v1` (the group of its enrollment consumer; see
`PEER_REVIEW_ASSIGNED_TOPIC`). Topic: `learnup.assessment.peer-review-assigned`; three partitions;
retention 30 days; key: learnerId (the reviewer). Envelope: [v1](event-envelope.schema.json), eventId = outbox.id,
occurredAt = the moment the cycle was closed. Delivery: at-least-once; consumers deduplicate eventId.
Event type: `PeerReviewAssigned` (BR-232).

One event is written for each reviewer, in the transaction that closes the cycle and creates the reviews, so a reviewer
is told if and only if the reviews exist. A cycle that went to the Instructor (too few submissions) writes none.

| data field | Meaning |
| --- | --- |
| learnerId | The Learner who has to review (also the Kafka key) |
| organizationId | The Organization (matches the envelope) |
| assessmentId | The Assignment |
| cycleId | The cycle that was closed |
| assignmentTitle | The title of the Assignment as the Instructor wrote it (at most 300 characters) |
| reviewCount | How many submissions this reviewer has to review in this cycle (1 or more) |
| reviewDueAt | When the reviews are due (ISO UTC) |

Nothing in the event names an author or a submission (BR-233).

notification-service tells the reviewer in the app (type `PEER_REVIEW`, metadata `assignmentId`, `cycleId`, `event`) and by
e-mail, in Vietnamese, with the deadline written in the time zone of the Organization. It records each delivery in its
ledger (event, person, channel) so a repeated event sends nothing again, skips an event older than 72 hours, and sends a
message that is not a valid event to `learnup.assessment.peer-review-assigned.DLT` without a retry.
