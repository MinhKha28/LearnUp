# Audit Service (`services/audit-service`)

## 1. Overview
The **Audit Service** is a cross-cutting supporting platform capability that captures, persists, and exposes immutable audit records and governance action trails across all LearnUP services.

---

## 2. Technology Stack & Runtime
* **Framework**: Spring Boot (Java 21) or NestJS (TypeScript)
* **Database**: PostgreSQL (`audit_db`)
* **Eureka Service Name**: `AUDIT-SERVICE`
* **Append-Oriented**: Audit records are strictly immutable and append-only.
* **Port**: 8083 by default (`server.port` in `application.yml`). On a machine that also runs course-service (its `.env.example` uses 8083 too) run audit on another port: `SERVER_PORT=8093 java -jar target/audit-service-1.0.0-SNAPSHOT.jar` (or `SERVER_PORT=8093 mvn spring-boot:run`). Tenant reaches it through `AUDIT_SERVICE_URL`, which its `.env.example` and `tests/e2e/cluster/start.sh` set to `http://localhost:8093`; in Docker Compose the container listens on 8083 and the host maps 8093 to it.

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
  * For the actions whose reason is mandatory (BR-337, see "Reason required" below), an entry whose `details` has no non-blank string `reason` is
    refused with `400` and **nothing is stored**. This check is a safety net: a writer must refuse a missing reason on its own endpoint **before**
    it performs the action, because a `400` here is not retried to success — Tenant's outbox relay retries it like any error (8 attempts, about
    10.6 minutes) and then marks the record failed for good (issue #287), so the trail would lose the record of an action that did happen.
* `GET /api/audit/logs` — Query paginated audit trails with filtering by `organizationId`, `actionType`, `targetResourceType`, `targetResourceId`, `actorUserId`, and a time range. The range is `from` (included) to `to` (excluded), both ISO-8601 instants (for example `2026-11-01T00:00:00Z`); either may be given alone, and `from` not before `to` is `400`. The time compared, shown and used for the order is one: `createdAt`. For a write that sends `occurredAt` it holds the time of the action (so a late retry does not move the entry to another day); for a write without it, and for the entries written before `occurredAt` existed, it holds the time audit-service received the entry. The order is fixed (newest first, the id breaks ties) and a `sort` parameter is ignored; a page has at most 100 entries (default 20).
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

## Action types (BR-336)

`actionType` is a code in `ENTITY_PAST_TENSE` capitals; `targetResourceType` names the entity (`User`, `Organization`, `Plan`, `Course`, `Material`, `Report`, `Submission`).
The reason (BR-337) goes in `details` as `{"reason": "..."}`, and the time of the action as the `occurredAt` field of the request.
The page of the audit trail (`frontend/src/utils/audit.log.ts`) has a Vietnamese word for each code of the table below; a code that is not in it is shown
as "Hành động khác" with the code next to it, so a service that picks another code only adds one line to that table.

| Code | BR-336 | Written by |
| --- | --- | --- |
| `INSTRUCTOR_DEACTIVATED`, `INSTRUCTOR_REACTIVATED`, `INSTRUCTOR_DELETED` | accounts (BR-45, BR-46, BR-51) | tenant (today) |
| `LEARNER_DEACTIVATED`, `LEARNER_REACTIVATED`, `ACCOUNT_DELETED` | accounts (BR-45, BR-46, BR-51) | proposed |
| `PLAN_UPDATED`, `PLAN_DISCONTINUED` | Plan (BR-2, BR-3) | proposed |
| `ORGANIZATION_SUSPENDED`, `ORGANIZATION_SUSPENSION_LIFTED` | suspension (BR-56, BR-58) | proposed |
| `ORGANIZER_REPLACED` | Organizer (BR-50) | proposed |
| `COURSE_APPROVED`, `COURSE_REJECTED` | approval (BR-84) | proposed |
| `COURSE_TYPE_CHANGED` | courseType (BR-75) | proposed |
| `COURSE_OWNERSHIP_TRANSFERRED` | ownership (BR-92) | proposed |
| `COURSE_DELETED`, `COURSE_RESTORED`, `COURSE_PURGED` | trash (BR-89, BR-340, BR-341) | proposed |
| `MATERIAL_FILE_REPLACED`, `ARCHIVED_MATERIAL_RELEASED` | materials (BR-105, BR-126, BR-91) | proposed |
| `CONTENT_DISABLED`, `CONTENT_REACTIVATED` | moderation (BR-296, BR-299, BR-306) | proposed |
| `REPORT_DECIDED` | report decisions (BR-294, BR-317) | proposed |
| `SCORE_FINALIZED`, `SCORE_ADJUSTED` | scores (BR-254) | proposed |

Not in the table yet: the actions on an Enrollment (exempted, due date: BR-146, BR-149, BR-170), until the Vietnamese word for Enrollment is chosen.

### Reason required (BR-337)

BR-337 makes the reason mandatory for the actions whose affected party is notified. audit-service enforces it for exactly these codes, the set
`REASON_REQUIRED` in `AuditLogService`:

| Code | BR-337 action |
| --- | --- |
| `ORGANIZATION_SUSPENDED` | suspend an Organization |
| `ORGANIZER_REPLACED` | replace the Organizer |
| `COURSE_REJECTED` | reject a Course |
| `CONTENT_DISABLED` | disable content or a Course |

* **The writer must validate the reason before the action.** The endpoint that suspends, replaces, rejects or disables answers `400` without a
  reason before it changes anything; a `400` from audit-service is not retried to success (see section 5).
* **The list is closed by code.** "Mark Exempted" (BR-146, BR-149) is the fifth BR-337 action and has no code yet, so it is not checked. The writer
  that chooses its code adds it to this table, to the table above and to `REASON_REQUIRED` (with a case in `AuditReasonRequirementTest`).
* Every other action keeps an optional reason.
