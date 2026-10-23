# Learning Enrollment events v1

Topic: `learnup.learning.enrollment-events`; three partitions; key: enrollmentId
(outbox aggregate_id); retention: 30 days; replication factor: configurable.
This shared topic is an intentional naming exception to preserve per-Enrollment
ordering across event types. Producer: learning-service. Delivery: at-least-once;
consumers deduplicate eventId. No notification consumer is included in L6.

Use event-envelope.schema.json. eventId = outbox.id; occurredAt = outbox.occurred_at
as ISO UTC; organizationId = outbox.organization_id; version = 1; data = payload.
Retries preserve those fields. Missing organization is an invalid row, never
replaced with a synthetic organization or published silently.

Every event data includes enrollmentId, organizationId, learnerId and courseId.
The relay forwards the existing writer payload without inventing business fields.

| eventType | Additional data fields |
| --- | --- |
| EnrollmentAssigned | assignedBy, assignedAt, dueAt (ISO timestamps), kind (writer's assignment result) |
| EnrollmentDueDateExtended | previousDueAt, newDueAt, reason (nullable), actorId, occurredAt |
| EnrollmentExempted | reason, actorId, exemptedAt |
| LearnerWithdrew | withdrawnAt |
| EnrollmentCompleted | enrollmentType, completedAt, dueAt (effective deadline; null for Optional), completedLate (false for Optional), scoreSnapshot, occurredAt (= completedAt) |

EnrollmentCompleted is consumed by achievement-reporting-service; notification-service
may ignore it. It uses the shared topic and enrollmentId key, envelope version 1.
Delivery remains at-least-once: deduplicate eventId and prevent duplicate completion
effects by enrollmentId (one completion per enrollment). Conversion of an already
Completed Optional enrollment never emits a second EnrollmentCompleted.
scoreSnapshot is the validated versioned assessment completion response, including
required Quiz attempts/scores, finalized Assignment submissions/scores, and peer
review obligations. Scores are decimal strings; schemaVersion is 1. Learning retains
the identical object in enrollments.completion_snapshot (BR-269). Fields include
snapshotId, asOf, revision, organizationId, learnerId, courseId, eligible,
requiredComponentCount, quizzes and assignments. Disabled assessments are excluded.

The five event types currently have no configured secret fields to redact after
publication. The event-type registry is extended when a future contract needs it;
redaction updates the database payload in the publication transaction, after ACK.
Arbitrary payload or broker error text must never appear in logs or last_error.
