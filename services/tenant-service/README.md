# Tenant Service (`services/tenant-service`)

## 1. Service Profile & Handoff Contract
* **Service Name**: `tenant-service`
* **Service Classification**: Business Service (1 of 5)
* **Implementation Target**: NestJS (TypeScript)
* **Dedicated Database**: PostgreSQL (`tenant_db`)
* **Service Discovery Registration**: `TENANT-SERVICE` (via Eureka)
* **Implementation Status**: **Skeleton Only** (Handoff to NestJS team)

---

## 2. Domain Ownership & Boundaries (Source of Truth)
The Tenant Service is the authoritative master for multi-tenancy, canonical user identity, organizations, and commercial subscriptions:
* **Canonical User & Account Master**: Owns canonical `user_id`, profile information, status, and organization memberships.
* **Organization Hierarchy**: Organization lifecycle, settings, enterprise configuration, and metadata.
* **Invitations & Cohorts**: Member invitations, verification tokens, learner tags, and cohort classifications.
* **Commercial Subscriptions & Billing**: Subscription pricing plans, active subscription lifecycles, seat limits, storage quota enforcement, payment transactions, and invoices.

---

## 3. Architectural & Integration Contracts

### 3.1 Gateway Integration
* Routed by Spring Cloud Gateway via predicate paths:
  - `/api/users/**`
  - `/api/organizations/**`
  - `/api/subscriptions/**`
  - `/api/payments/**`
* Downstream requests arrive with sanitized, trusted identity headers injected by API Gateway:
  - `X-User-ID`: Canonical authenticated user ID (UUID)
  - `X-Organization-ID`: Tenant organization identifier (UUID)
  - `X-User-Role`: Authenticated role (`ADMIN`, `ORGANIZER`, `INSTRUCTOR`, `LEARNER`)
  - `X-Correlation-ID`: Distributed tracing identifier

### 3.2 Database & Data Isolation
* **Strict Database Ownership**: Exclusive owner of `tenant_db`.
* **No Cross-Database Access**: Absolutely no direct SQL connections, joins, or foreign keys across other service databases (`identity_db`, `course_db`, `learning_db`, etc.).
* **Credentials Separation**: User authentication credentials, password hashing, refresh tokens, and JWT signing remain in `identity-service` (`identity_db`).

### 3.3 REST & API Design
* Synchronous REST communication must return standardized response structures (`ApiResponse<T>`, `PageResponse<T>`).
* Cross-service synchronous queries should be minimized in favor of asynchronous event propagation.

### 3.4 Kafka & Transactional Outbox Pattern
* Any domain event publication caused by local database mutations MUST use the **Transactional Outbox Pattern**:
  1. Business mutation + Outbox event record inserted in the same local `tenant_db` transaction.
  2. Asynchronous relay worker publishes outbox records to Kafka broker (`kafka:29092`).
* Downstream message consumers must implement idempotency checks based on `eventId`.
* All event envelopes must include `eventId`, `eventType`, `occurredAt`, `organizationId`, and `producer`.

### 3.5 Shared Libraries & Dependencies
* **No Shared Java Domain Entities**: Must not import business domain entities or repositories from Java libraries.
* Technical TypeScript utilities and schemas should be consumed from `@learnup/ts-common`.
