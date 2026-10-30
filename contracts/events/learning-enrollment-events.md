# Learning Enrollment events v1

Topic: `learnup.learning.enrollment-events`; three partitions; key: enrollmentId
(outbox aggregate_id); retention: 30 days; replication factor: configurable.
This shared topic is an intentional naming exception to preserve per-Enrollment
ordering across event types. Producer: learning-service. Delivery: at-least-once;
consumers deduplicate eventId. notification-service consumes EnrollmentAssigned,
EnrollmentDueDateExtended, EnrollmentExempted and LearnerWithdrew (see the section
"notification-service consumer" below); the relay of L6 itself includes no consumer.

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
review obligations. Scores are decimal strings; schemaVersion is 1. Learning retains
the identical object in enrollments.completion_snapshot (BR-269). Fields include
snapshotId, asOf, revision, organizationId, learnerId, courseId, eligible,
requiredComponentCount, quizzes and assignments. Disabled assessments are excluded.
`scoreSnapshot` is an object, never an array. Achievement stores the exact
versioned object; it does not fetch current assessment scores when issuing.

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

## notification-service consumer

Group `notification-enrollment-events-v1` (`earliest` for a group with no committed offset),
enabled by `ENROLLMENT_EVENTS_CONSUMER_ENABLED` (off in the service by default, on in Compose). It reads
the envelope only: eventId, occurredAt and organizationId come from the envelope and the copy in `data`
is not read. Other event types, including EnrollmentCompleted, are ignored.

| eventType | What the Learner (data.learnerId) gets |
| --- | --- |
| EnrollmentAssigned, kind CREATE, CONVERT, RESTORE | In-app notice and e-mail with the Course name and the due date |
| EnrollmentAssigned, kind CONVERT_COMPLETED | The same without a due date |
| EnrollmentDueDateExtended | The new due date, the previous one and the reason when sent |
| EnrollmentExempted | The reason |
| LearnerWithdrew | Nothing (decision D2 of 23/10) |

`dueAt`, `newDueAt` and `previousDueAt` are written as the end of the day in the time zone of the
Organization (BR-167; learning stores 00:00 of the next day), for example "hết ngày 10/01/2027"; the zone is
Asia/Ho_Chi_Minh until tenant-service gives the one of the Organization. The name and e-mail of the Learner
come from tenant-service (`POST /api/v1/internal/users/display-names`, with `x-organization-id` from the
envelope) and the Course name from course-service (`POST /api/v1/internal/courses/batch`).

Each message owed has one row in `notification_db.enrollment_event_deliveries`, unique on (eventId,
recipient, channel), so a repeated event sends nothing again. Status: PENDING, PROCESSING, SENT, FAILED, SKIPPED
(SENT and SKIPPED are final; a mail that is only simulated because mail is off counts as SENT, so enabling SMTP
later does not resend it); a fixed error code, never text of a payload or of an error. A handler claims a
delivery (PROCESSING, with the time of the claim) before it sends anything, so two handlers on one event send once;
a claim older than `ENROLLMENT_EVENTS_CLAIM_LEASE` (2 m) is taken over. An event older than `ENROLLMENT_EVENTS_MAX_AGE` (72 h)
is SKIPPED (EVENT_TOO_OLD); a Learner who is missing, deleted or deactivated is SKIPPED
(RECIPIENT_UNAVAILABLE); a Learner without an e-mail still gets the in-app notice (EMAIL SKIPPED, NO_EMAIL).

A service that does not answer (tenant, course, SMTP) is tried again with a growing pause (5 tries by
default, 1 s to 30 s). After the last try, and at once for a message that is not a valid event, the message
goes to `learnup.learning.enrollment-events.DLT` and the offset moves on. Nothing replays the dead-letter
topic automatically. Delivery is at least once: an e-mail cannot share a database transaction, so if the
process stops between the SMTP server accepting it and the row saying SENT, that mail may be sent twice; the
in-app notice and its row are written together and cannot be doubled.

The consumer is started by the service, not by Spring at start-up: when Kafka is down at that moment the
service still starts (its REST API does not depend on Kafka) and the consumer is started again every
`ENROLLMENT_EVENTS_START_RETRY_INTERVAL` (10 s) until the broker answers. The dead-letter topic is created with
`ENROLLMENT_EVENTS_DLT_PARTITIONS` (3) and `ENROLLMENT_EVENTS_DLT_REPLICAS` (1) if the broker does not have it;
its partitions need not match the source topic. The DLT values keep the original event: treat them as restricted data.
