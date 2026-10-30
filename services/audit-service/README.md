# Audit Service (`services/audit-service`)

## 1. Overview
The **Audit Service** is a cross-cutting supporting platform capability that captures, persists, and exposes immutable audit records and governance action trails across all LearnUP services.

---

## 2. Technology Stack & Runtime
* **Framework**: Spring Boot (Java 21) or NestJS (TypeScript)
* **Database**: PostgreSQL (`audit_db`)
* **Eureka Service Name**: `AUDIT-SERVICE`
* **Append-Oriented**: Audit records are strictly immutable and append-only.

---

## 3. Key Architectural Principles

### 3.1 Separation of Governance Decision vs. Domain State Mutation
> **Governance / Audit records the decision or action. The domain-owning service owns the actual state mutation.**

* **Example 1: Disabling a Course**
  * Admin / Governance decision is logged in Audit Service.
  * Course Service handles the actual status transition: `Course.status = DISABLED`.
* **Example 2: Waiving an Enrollment**
  * Organization / Instructor decision is logged in Audit Service.
  * Learning Service changes the actual enrollment state: `Enrollment.status = WAIVED`.
* **Example 3: Disabling a User Account**
  * Governance decision is logged in Audit Service.
  * Identity Service updates the user account state: `User.enabled = false`.

### 3.2 Durability Semantics & Non-Over-Engineering
* Audit persistence failures are **explicitly visible** and not silently swallowed.
* No complex Saga, Transactional Outbox, or two-phase commit is introduced for local development. Standard synchronous REST or transactional write semantics are used.

### 3.3 What Audit Service Does NOT Own:
* Does NOT directly modify another service's database.
* Does NOT own the business lifecycle of Users, Organizations, Courses, Enrollments, Assessments, or Certificates.

---

## 4. Database Entities (`audit_db`)
* `AuditLogEntry`
  * `id`: UUID (Primary Key)
  * `organizationId`: UUID (Nullable for platform-wide system events)
  * `actorUserId`: UUID (User who performed the action)
  * `actorRole`: String (`ADMIN`, `ORGANIZER`, `INSTRUCTOR`, `LEARNER`, `SYSTEM`)
  * `actionType`: String (e.g. `COURSE_DISABLED`, `ENROLLMENT_WAIVED`, `USER_DISABLED`, `ORGANIZATION_SUSPENDED`, `TAG_CREATED`, `MEMBER_INVITED`)
  * `targetResourceType`: String (e.g. `COURSE`, `ENROLLMENT`, `USER`, `ORGANIZATION`, `TAG`, `ASSESSMENT`)
  * `targetResourceId`: String (Identifier of the modified entity)
  * `timestamp`: Instant (UTC creation timestamp)
  * `details`: JSON / Text (Structured metadata, before/after values, or justification notes)
  * `correlationId`: String (Trace identifier from `X-Correlation-ID`)
  * `ipAddress`: String (Client IP address if captured)

---

## 5. REST API Endpoints
* `POST /api/audit/logs` — Record a new immutable audit entry.
* `GET /api/audit/logs` — Query paginated audit trails with filtering by `organizationId`, `targetResourceType`, `targetResourceId`, `actorUserId`, and date range.
* `GET /api/audit/logs/{id}` — Fetch full detail of a specific audit event.

---

## 6. Access control

The trail is append-only and holds who did what in every Organization, so access is checked by the service itself (`AuditServiceAuthenticationFilter`), not only by the gateway.

| Who | `POST /api/v1/audit/logs` | `GET /api/v1/audit/logs`, `GET /api/v1/audit/logs/{id}` |
| --- | --- | --- |
| No `x-internal-key`, or a wrong one | 401 | 401 |
| A service (the internal key, no user context) | 201 | 403 |
| Admin (gateway headers) | 403 | All entries, any `organizationId` filter |
| Organizer (gateway headers, with `X-Organization-ID`) | 403 | Only the own Organization; another `organizationId` is 403; an entry of another Organization or a platform entry is 404 |
| Instructor, Learner, any other or missing role | 403 | 403 |

(UC50 and UC51: an Organizer reads the own Organization, an Admin reads the platform and the actions on Organizations, Instructors and Learners read nothing.)

* The gateway routes only `GET` to this service; the services write entries to it directly (internal key, no user headers).
* `INTERNAL_SERVICE_KEY` is required (at least 32 bytes, not `learnup-internal-secret`); the service does not start without it. It is the same key as in the other services.
* Every path except `/actuator/health` goes through the filter.
