# Course Service (`services/course-service`)

## 1. Service Profile & Handoff Contract
* **Service Name**: `course-service`
* **Service Classification**: Business Service (2 of 5)
* **Implementation Target**: NestJS (TypeScript)
* **Dedicated Database**: PostgreSQL (`course_db`)
* **Service Discovery Registration**: `COURSE-SERVICE` (via Eureka)
* **Implementation Status**: **Skeleton Only** (Handoff to NestJS team)

---

## 2. Domain Ownership & Boundaries (Source of Truth)
The Course Service is the authoritative master for curriculum authoring, course structure, and material management:
* **Course Master & Versioning**: Course catalog, course metadata, version lifecycle states (`Draft`, `Submitted`, `Published`, `Rejected`, `Archived`, `Disabled`).
* **Syllabus Hierarchy**: Hierarchical curriculum structure: Course $\rightarrow$ Modules $\rightarrow$ Lessons.
* **Content Materials**: Lesson content metadata, reading/video resource attachment references, prerequisites.
* **Course Structure Lock**: Irreversible lock on syllabus structure upon the first active learner enrollment.
* **Course Type**: Public catalog vs Private organization-scoped courses.

---

## 3. Architectural & Integration Contracts

### 3.1 Gateway Integration
* Routed by Spring Cloud Gateway via predicate path:
  - `/api/courses/**`
* Downstream requests arrive with sanitized, trusted identity headers injected by API Gateway:
  - `X-User-ID`: Canonical authenticated user ID (UUID)
  - `X-Organization-ID`: Tenant organization identifier (UUID)
  - `X-User-Role`: Authenticated role (`ADMIN`, `ORGANIZER`, `INSTRUCTOR`, `LEARNER`)
  - `X-Correlation-ID`: Distributed tracing identifier

### 3.2 Database & Data Isolation
* **Strict Database Ownership**: Exclusive owner of `course_db`.
* **No Cross-Database Access**: Absolutely no direct SQL connections, joins, or foreign keys across other service databases (`tenant_db`, `learning_db`, `assessment_db`, etc.).
* **Enrollments & Progress**: Learner progress and enrollments are owned exclusively by **Learning Service** (`learning_db`).

### 3.3 REST & API Design
* Synchronous REST communication must return standardized response structures (`ApiResponse<T>`, `PageResponse<T>`).
* Multi-tenancy filtering must be strictly enforced via `organizationId` from headers.

### 3.4 Kafka & Transactional Outbox Pattern
* Any domain event publication (e.g. `CourseDisabled`, `CoursePublished`) caused by local database mutations MUST use the **Transactional Outbox Pattern**:
  1. Business mutation + Outbox record inserted in the same local `course_db` transaction.
  2. Asynchronous relay worker publishes outbox records to Kafka broker (`kafka:29092`).
* Downstream message consumers must implement idempotency checks based on `eventId`.
* All event envelopes must include `eventId`, `eventType`, `occurredAt`, `organizationId`, and `producer`.

### 3.5 Shared Libraries & Dependencies
* **No Shared Java Domain Entities**: Must not import business domain entities or repositories from Java libraries.
* Technical TypeScript utilities and schemas should be consumed from `@learnup/ts-common`.
