# Learning Service (`services/learning-service`)

## 1. Service Profile & Handoff Contract
* **Service Name**: `learning-service`
* **Service Classification**: Business Service (3 of 5)
* **Implementation Target**: NestJS (TypeScript)
* **Dedicated Database**: PostgreSQL (`learning_db`)
* **Service Discovery Registration**: `LEARNING-SERVICE` (via Eureka)
* **Implementation Status**: **Skeleton Only** (Handoff to NestJS team)

---

## 2. Domain Ownership & Boundaries (Source of Truth)
The Learning Service is the authoritative master for enrollment states, learner progress, and assignment lifecycles:
* **Enrollments & Assignments**: Voluntary self-enrollments (`OPTIONAL`) and mandatory assignments (`REQUIRED`).
* **Enrollment State Machine**: Full 7-state lifecycle (`NotStarted`, `InProgress`, `Completed`, `Overdue`, `Exempted`, `Withdrawn`, `Halted`).
* **Progress Tracking**: Lesson progress tracking, material access checks, and course completion percentage calculation.
* **Course Disabled Reaction**: Consumes `CourseDisabled` domain events to transition active enrollments to `Halted`.
* **Completion Broadcasting**: Publishes `CourseCompleted` event via Transactional Outbox upon reaching 100% completion.

---

## 3. Architectural & Integration Contracts

### 3.1 Gateway Integration
* Routed by Spring Cloud Gateway via predicate path:
  - `/api/learning/**`
* Downstream requests arrive with sanitized, trusted identity headers injected by API Gateway:
  - `X-User-ID`: Canonical authenticated user ID (UUID)
  - `X-Organization-ID`: Tenant organization identifier (UUID)
  - `X-User-Role`: Authenticated role (`ADMIN`, `ORGANIZER`, `INSTRUCTOR`, `LEARNER`)
  - `X-Correlation-ID`: Distributed tracing identifier

### 3.2 Database & Data Isolation
* **Strict Database Ownership**: Exclusive owner of `learning_db`.
* **No Cross-Database Access**: Absolutely no direct SQL connections, joins, or foreign keys across other service databases (`tenant_db`, `course_db`, `assessment_db`, etc.).
* **Separation of Authoring vs Progress**: Course syllabus data is read from `course-service` via REST/events, never by querying `course_db`.

### 3.3 REST & API Design
* Synchronous REST communication must return standardized response structures (`ApiResponse<T>`, `PageResponse<T>`).
* Multi-tenancy filtering must be strictly enforced via `organizationId` from headers.

### 3.4 Kafka & Transactional Outbox Pattern
* Any domain event publication (such as `learnup.learning.course-completed`) caused by local database mutations MUST use the **Transactional Outbox Pattern**:
  1. Enrollment completion mutation + Outbox record inserted in the same local `learning_db` transaction.
  2. Asynchronous relay worker publishes outbox records to Kafka broker (`kafka:29092`).
* Downstream message consumers must implement idempotency checks based on `eventId`.
* All event envelopes must include `eventId`, `eventType`, `occurredAt`, `organizationId`, and `producer`.

### 3.5 Shared Libraries & Dependencies
* **No Shared Java Domain Entities**: Must not import business domain entities or repositories from Java libraries.
* Technical TypeScript utilities and schemas should be consumed from `@learnup/ts-common`.
