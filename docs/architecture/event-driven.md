# Asynchronous Event-Driven Architecture with Apache Kafka

LearnUP utilizes **Apache Kafka** exclusively for asynchronous domain event broadcasting. Kafka enables loose coupling between microservices when one service needs to announce a significant business occurrence to multiple independent consumers.

---

## 1. REST vs. Kafka Decision Framework

| Criterion | Synchronous REST | Asynchronous Kafka Event |
| :--- | :--- | :--- |
| **Interaction Style** | Request / Response (Immediate answer) | Publish / Subscribe (Fire-and-forget notification) |
| **Topology** | 1-to-1 direct service call | 1-to-Many broadcast |
| **Coupling** | Caller depends on receiver's availability | Producer has zero knowledge of consumers |
| **Use Case Examples** | Fetching learner tags for assignment screen; Verifying user identity during login | `CourseCompleted` triggering Certificate & Notification; `RequiredCourseAssigned` triggering notification |

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
