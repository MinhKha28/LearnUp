# Assessment Service (`services/assessment-service`)

## 1. Service Profile & Handoff Contract
* **Service Name**: `assessment-service`
* **Service Classification**: Business Service (4 of 5)
* **Implementation Target**: NestJS (TypeScript)
* **Dedicated Database**: PostgreSQL (`assessment_db`)
* **Service Discovery Registration**: `ASSESSMENT-SERVICE` (via Eureka)
* **Implementation Status**: **Skeleton Only** (Handoff to NestJS team)

---

## 2. Domain Ownership & Boundaries (Source of Truth)
The Assessment Service is the authoritative master for quizzes, assignments, submissions, and evaluations:
* **Assessment Authoring**: Quiz creation, question banks, answer keys, scoring rubrics.
* **Deterministic Auto-Grading**: Rule-based grading for Multiple-Choice Questions (strictly non-AI).
* **Attempt Constraints**: Maximum attempt counts, time limit enforcement, retake cooldown intervals.
* **Assignment Submissions**: Learner file/text submissions, instructor manual grading, feedback, and grade overrides.
* **Grade Records**: Immutable submission history and grade ledger.

---

## 3. Architectural & Integration Contracts

### 3.1 Gateway Integration
* Routed by Spring Cloud Gateway via predicate path:
  - `/api/assessments/**`
* Downstream requests arrive with sanitized, trusted identity headers injected by API Gateway:
  - `X-User-ID`: Canonical authenticated user ID (UUID)
  - `X-Organization-ID`: Tenant organization identifier (UUID)
  - `X-User-Role`: Authenticated role (`ADMIN`, `ORGANIZER`, `INSTRUCTOR`, `LEARNER`)
  - `X-Correlation-ID`: Distributed tracing identifier

### 3.2 Database & Data Isolation
* **Strict Database Ownership**: Exclusive owner of `assessment_db`.
* **No Cross-Database Access**: Absolutely no direct SQL connections, joins, or foreign keys across other service databases (`tenant_db`, `course_db`, `learning_db`, etc.).
* **Course Structure & Progress**: Course metadata is owned by `course-service` (`course_db`); overall course completion is calculated by `learning-service` (`learning_db`).

### 3.3 REST & API Design
* Synchronous REST communication must return standardized response structures (`ApiResponse<T>`, `PageResponse<T>`).
* Multi-tenancy filtering must be strictly enforced via `organizationId` from headers.

### 3.4 Kafka & Transactional Outbox Pattern
* Any domain event publication (e.g. `AssessmentPassed`, `SubmissionGraded`) caused by local database mutations MUST use the **Transactional Outbox Pattern**:
  1. Grade mutation + Outbox record inserted in the same local `assessment_db` transaction.
  2. Asynchronous relay worker publishes outbox records to Kafka broker (`kafka:29092`).
* Downstream message consumers must implement idempotency checks based on `eventId`.
* All event envelopes must include `eventId`, `eventType`, `occurredAt`, `organizationId`, and `producer`.

### 3.5 Shared Libraries & Dependencies
* **No Shared Java Domain Entities**: Must not import business domain entities or repositories from Java libraries.
* Technical TypeScript utilities and schemas should be consumed from `@learnup/ts-common`.
