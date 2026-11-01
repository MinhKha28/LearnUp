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
The certificate consumer group is `achievement-reporting-certificate-v1`, with
`earliest` for a group with no committed offset. It is disabled by default through
`CERTIFICATE_CONSUMER_ENABLED=false`.
Delivery remains at-least-once: deduplicate eventId and prevent duplicate completion
effects by enrollmentId (one completion per enrollment). Conversion of an already
Completed Optional enrollment never emits a second EnrollmentCompleted.
scoreSnapshot is the validated versioned assessment completion response, including
required Quiz attempts/scores, finalized Assignment submissions/scores, and peer
review obligations. Scores and passing scores are strings from 0 to 100 inclusive,
with at most two decimal places, no sign, and no leading or trailing decimal point
(BR-202). Recorded and final scores may be null; passing scores are required.
schemaVersion is 1. Learning retains
the identical object in enrollments.completion_snapshot (BR-269). Fields include
snapshotId, asOf, revision, organizationId, learnerId, courseId, eligible,
requiredComponentCount, quizzes and assignments. Disabled assessments are excluded.
`scoreSnapshot` is an object, never an array. Achievement stores the exact
versioned object; it does not fetch current assessment scores when issuing.
Peer-review status accepts `Waived` alongside `NotApplicable`, `Pending`, `Satisfied`
and `Missed`. A waiver may retain partially completed review counts. Learning computes
completion from score facts, finalization and satisfied peer duty (`Waived`,
`NotApplicable`, `Satisfied`). The original assessment `eligible` and item `passed`
flags remain unchanged in both snapshots, even when they differ from Learning's
decision; Achievement validates structure and trusts `EnrollmentCompleted` for
issuance without re-judging these flags. In a stored certificate,
`scoreSnapshot.eligible` and item `passed` remain Assessment's own figures for
traceability; Learning's recomputation decides whether to complete the enrollment.

A course whose only required components are materials completes and is eligible
for a certificate when all required materials are done (BR-260, BR-196). A course
with no required component never completes.

Achievement commits a Pending Certificate and its `processed_completion_events`
receipt atomically before committing Kafka offset + 1. Duplicate event IDs and
completion identities do not create another Certificate. An inconsistent repeat
is quarantined and warned without overwriting the original completion data.
Invalid JSON, unsupported completion versions or invalid payloads are persisted
in `completion_event_quarantine` (topic/partition/offset, readable event ID,
reason, payload, received time) before committing that offset. The next message
on the partition may then proceed. Non-JSON bytes, JSON values unsupported by
PostgreSQL jsonb, and excessively deep JSON use a lossless `rawBase64` wrapper.
Quarantine payloads are restricted database records, never application log data;
there is no public quarantine API or replay script in PR1. If this database
transaction fails, no offset is committed and the broker re-delivers.

Issuance runs after the receiving transaction, with bounded concurrency, leases,
and indefinite Pending retries. `issued_at` is always event `completedAt`;
`issued_recorded_at` records technical completion for latency measurements.

The five event types currently have no configured secret fields to redact after
publication. The event-type registry is extended when a future contract needs it;
redaction updates the database payload in the publication transaction, after ACK.
Arbitrary payload or broker error text must never appear in logs or last_error.
