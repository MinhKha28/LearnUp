# Event Contracts & Schemas

This directory contains the canonical JSON Schemas and sample payloads for domain events published to Apache Kafka across the LearnUP platform.

---

## 1. Schema Specifications
* [`event-envelope.schema.json`](file:///d:/Study/learnup/contracts/events/event-envelope.schema.json) — Top-level event envelope schema that all LearnUP domain events conform to.
* [`course-completed.example.json`](file:///d:/Study/learnup/contracts/events/course-completed.example.json) — Example payload for the `CourseCompleted` domain event.

---

## 2. Topic Catalog
* `learnup.course.course-component-events` — Course Service publishes `CourseSubmitted` (UC20) and Course lifecycle events; see [CourseSubmitted contract](course-submitted.md) and [example](course-submitted.example.json).
* `learnup.assessment.learner-assessment-events` — Assessment Service produces `LearnerAssessmentStatusChanged`; Learning Service consumes it for activation and completion re-evaluation. See [assessment status contract](assessment-status-events.md).
* `learnup.learning.course-completed` — Fired by Learning Service when a learner finishes all mandatory lessons/quizzes.
* `learnup.learning.enrollment-events` — EnrollmentAssigned, EnrollmentDueDateExtended, EnrollmentExempted and LearnerWithdrew; see [Enrollment contracts](learning-enrollment-events.md).
* `learnup.assessment.learner-assessment-events` — `LearnerAssessmentStatusChanged`, fired by Assessment Service when what a Learner did on a Quiz or Assignment changes (submitted, peer review waived, …). Key: learnerId. Envelope v1, producer `assessment-service`. Payload: `assessmentId`, `courseId`, `learnerId`, `organizationId`, `kind`, `status`, `reason`, `revision`, `firstActivityAt` and the fields of the reason; see `docs/database/AssessmentService_Database_Design.md` section 5.3.
* `learnup.assessment.peer-review-assigned` — `PeerReviewAssigned`, one event for each reviewer when Assessment Service closes a peer review cycle and hands the reviews out (BR-232); Notification Service tells the reviewer. See [Assessment peer review events](assessment-peer-review-events.md).
* `learnup.assessment.passed` — Fired by Assessment Service when an assessment requirement is passed.
* `learnup.certificate.issued` — Fired by Achievement & Reporting Service when a certificate record is generated.
