# Asynchronous Event-Driven Architecture with Apache Kafka

LearnUP utilizes **Apache Kafka** exclusively for asynchronous domain event broadcasting. Kafka enables loose coupling between microservices when one service needs to announce a significant business occurrence to multiple independent consumers.

---

## 1. REST vs. Kafka Decision Framework

| Criterion | Synchronous REST | Asynchronous Kafka Event |
| :--- | :--- | :--- |
| **Interaction Style** | Request / Response (Immediate answer) | Publish / Subscribe (Fire-and-forget notification) |
| **Topology** | 1-to-1 direct service call | 1-to-Many broadcast |
| **Coupling** | Caller depends on receiver's availability | Producer has zero knowledge of consumers |
| **Use Case Examples** | Fetching learner tags for assignment screen; Verifying user identity during login | `CourseCompleted` triggering Certificate & Email dispatch; `RequiredCourseAssigned` triggering email dispatch |

**Strict Rule**: Do NOT replace direct synchronous queries with Kafka. Kafka is only for event distribution.

---

## 2. Standard Event Envelope

All events published to Kafka MUST wrap payload data inside the canonical LearnUP Event Envelope.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "eventId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "eventType": "CourseCompleted",
  "version": 1,
  "occurredAt": "2026-09-14T10:30:00Z",
  "organizationId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "producer": "learning-service",
  "data": {
    "learnerId": "123e4567-e89b-12d3-a456-426614174000",
    "courseId": "987fcdeb-51a2-43d7-b890-abcdef123456",
    "completionDate": "2026-09-14T10:30:00Z",
    "finalScore": 92.5
  }
}
```

### Envelope Fields Specification:
* `eventId` (`string`, UUID): Unique event identifier for tracing and deduplication.
* `eventType` (`string`): PascalCase domain event identifier (e.g. `CourseCompleted`, `RequiredAssignmentCreated`, `PeerReviewSubmitted`).
* `version` (`integer`): Monotonically increasing schema version number (starts at 1).
* `occurredAt` (`string`, ISO-8601): UTC timestamp when the domain event occurred.
* `organizationId` (`string`, UUID): Tenant organization identifier ensuring tenant context propagation.
* `producer` (`string`): Originating service identifier (e.g., `learning-service`, `assessment-service`).
* `data` (`object`): Domain-specific payload.

---

## 3. Topic Naming Conventions

Topics follow a hierarchical, predictable dot-separated format:

```text
learnup.<domain>.<event-type-kebab>
```

Examples:
* `learnup.learning.course-completed`
* `learnup.learning.assignment-created`
* `learnup.assessment.peer-review-submitted`
* `learnup.organization.member-invited`

---

## 4. Architectural Boundaries & Excluded Complexities

To maintain simplicity, clarity, and avoid unnecessary technical failure modes for the graduation thesis, the following distributed messaging patterns are **explicitly excluded**:

* **NO Saga Orchestrators** (Business workflows are partitioned across discrete services with clear completion states).
* **NO Event Sourcing** (PostgreSQL is the source of truth for all service state).
* **NO CQRS Frameworks** (Services handle their own reads and writes).
* **NO Transactional Outbox Engines** (Simple producer abstractions with standard retry configuration).


## Learning Enrollment outbox relay (L6, BR-143)

`learnup.learning.enrollment-events` intentionally groups EnrollmentAssigned,
EnrollmentDueDateExtended, EnrollmentExempted and LearnerWithdrew in one topic.
This is an exception to `learnup.<domain>.<event-type-kebab>`: key = enrollmentId
(outbox aggregate_id) keeps one Enrollment on one partition. The topic has three
partitions, 30-day retention, and configurable replication factor (Compose: 1).
Do not increase partitions without planning the effect on existing key ordering.

The API process hosts a non-overlapping relay; repository and Kafka producer are
separate providers for a future worker. Each transaction locks at most 20 aggregate
heads using FOR UPDATE SKIP LOCKED. A lower unpublished id blocks successors even
while that head is locked or in backoff. Ordering is by outbox id, as specified by
the existing UUIDv7-based outbox contract, not by a new timestamp generated at send.

Delivery is at-least-once. eventId, occurredAt and organizationId come from the
outbox row, producer is learning-service, version is 1, and data is the stored
payload. Consumers must deduplicate by eventId. Kafka acknowledgement precedes
published_at and payload redaction in the same PostgreSQL transaction. Kafka ACK
and PostgreSQL commit cannot be made atomic; crash recovery can replay an event.

A live broker metadata probe precedes the database transaction. A failed probe
opens no transaction and changes no attempts. A broker outage during delivery
backs off the entire batch without per-message retries. Only explicit record
errors trigger parallel individual retries. The idempotent producer uses acks=all
and one in-flight request per broker. Message delivery is bounded to 10 seconds;
transaction timeout is 30 seconds and must exceed twice delivery timeout plus
5 seconds of SQL margin. Shutdown stops polling, awaits the active turn and then
disconnects Kafka before Prisma disconnects during application shutdown.

Retry delay is min(1000 * 2^(attempts-1), 300000) milliseconds. From attempt 10,
failures produce error alerts. No retry limit marks a row published or skips it.
Unknown errors are treated as common failures. Only safe error codes are stored
and logged; payloads and arbitrary exception messages are excluded. Redaction is
an event-type field allowlist, currently empty for the four supported events.
An hourly pass deletes at most 1000 published rows older than seven days, never
unpublished rows. Backlogs are drained by subsequent hourly passes.
