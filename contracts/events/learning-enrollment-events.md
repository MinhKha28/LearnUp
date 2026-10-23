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

The four event types currently have no configured secret fields to redact after
publication. The event-type registry is extended when a future contract needs it;
redaction updates the database payload in the publication transaction, after ACK.
Arbitrary payload or broker error text must never appear in logs or last_error.
