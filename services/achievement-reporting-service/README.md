# Achievement & Reporting Service (`services/achievement-reporting-service`)

## 1. Service Profile & Handoff Contract
* **Service Name**: `achievement-reporting-service`
* **Service Classification**: Business Service (5 of 5)
* **Implementation Target**: NestJS (TypeScript)
* **Dedicated Database**: PostgreSQL (`achievement_reporting_db`)
* **Service Discovery Registration**: `ACHIEVEMENT-REPORTING-SERVICE` (via Eureka)
* **Implementation Status**: **Skeleton Only** (Handoff to NestJS team)

---

## 2. Domain Ownership & Boundaries (Source of Truth)
The Achievement & Reporting Service is the authoritative master for certificates, evaluations, and compliance analytics:
* **Verifiable Certificates**: Certificate issuance upon receiving `CourseCompleted` events, unique cryptographic verification codes, public certificate validation endpoint (`/api/certificates/verify/**`).
* **Training Evaluations**: Post-course evaluation forms, learner feedback collection, ratings aggregation.
* **Learning Analytics & Dashboards**: Aggregated completion statistics, cohort progress analytics, score distributions.
* **Enterprise Compliance Reporting**: Mandatory training compliance reports and exportable audit matrices.

---

## 3. Architectural & Integration Contracts

### 3.1 Gateway Integration
* Routed by Spring Cloud Gateway via predicate paths:
  - `/api/certificates/**`
  - `/api/reports/**`
  - `/api/governance/**`
* Public whitelist in Gateway:
  - `/api/certificates/verify/**` (unauthenticated verification portal)
* Protected routes arrive with sanitized, trusted identity headers injected by API Gateway:
  - `X-User-ID`: Canonical authenticated user ID (UUID)
  - `X-Organization-ID`: Tenant organization identifier (UUID)
  - `X-User-Role`: Authenticated role (`ADMIN`, `ORGANIZER`, `INSTRUCTOR`, `LEARNER`)
  - `X-Correlation-ID`: Distributed tracing identifier

### 3.2 Database & Data Isolation
* **Strict Database Ownership**: Exclusive owner of `achievement_reporting_db`.
* **No Cross-Database Access**: Absolutely no direct SQL connections, joins, or foreign keys across other service databases (`tenant_db`, `course_db`, `learning_db`, `assessment_db`, etc.).
* **Completion Computation**: Course completion is calculated by `learning-service` (`learning_db`), not recomputed directly from raw logs.

### 3.3 REST & API Design
* Synchronous REST communication must return standardized response structures (`ApiResponse<T>`, `PageResponse<T>`).
* Multi-tenancy filtering must be strictly enforced via `organizationId` from headers.

### 3.4 Kafka & Transactional Outbox Pattern
* Consumes `learnup.learning.course-completed` to trigger certificate generation.
* Any domain event publication (e.g. `CertificateIssued`) caused by local database mutations MUST use the **Transactional Outbox Pattern**:
  1. Certificate creation record + Outbox record inserted in the same local `achievement_reporting_db` transaction.
  2. Asynchronous relay worker publishes outbox records to Kafka broker (`kafka:29092`).
* Downstream message consumers must implement idempotency checks based on `eventId`.
* All event envelopes must include `eventId`, `eventType`, `occurredAt`, `organizationId`, and `producer`.

### 3.5 Shared Libraries & Dependencies
* **No Shared Java Domain Entities**: Must not import business domain entities or repositories from Java libraries.
* Technical TypeScript utilities and schemas should be consumed from `@learnup/ts-common`.
