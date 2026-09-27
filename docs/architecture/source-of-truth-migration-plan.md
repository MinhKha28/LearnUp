# LearnUP — Source-of-Truth Alignment & Migration Plan

---

## A. SOURCE-OF-TRUTH CONFLICT MATRIX

| Area | Current Code / Repo State | Finalized Target Specification | Action Required | Severity |
| :--- | :--- | :--- | :--- | :--- |
| **Application Services Count** | 9 service folders (`identity-service`, `organization-commercial-service`, `course-service`, `learning-service`, `assessment-service`, `achievement-reporting-service`, `media-storage-service`, `audit-service`, `email-service`). | **Exactly 8 application services**: 5 Business (`tenant-service`, `course-service`, `learning-service`, `assessment-service`, `achievement-reporting-service`) + 3 Supporting (`identity-service`, `notification-service`, `audit-service`). | Remove `media-storage-service` and `email-service` as standalone application services. Restore `notification-service`. | **BLOCKER** |
| **Tenant Service Identity & DB** | Directory: `services/organization-commercial-service`<br>DB: `organization_commercial_db` | Directory: `services/tenant-service`<br>Application Name: `tenant-service`<br>DB: `tenant_db` | Rename folder, service name, database name, and Gateway routes. | **HIGH** |
| **Account / User Ownership** | `identity-service` owns `identity_db.users` (`username`, `email`, `full_name`, `role`, `organization_id`, `enabled`). | `tenant-service` (`tenant_db`) owns the Account/User record (`user_id`, login email, full name, avatar, role, work unit, account status, membership, invitation code, email verification). | Migrate user/account profile ownership to `tenant-service`. Remove account fields from `identity-service`. | **BLOCKER** |
| **Credential / Auth Ownership** | `identity-service` owns credentials mixed with account profile inside `users` table. | `identity-service` (`identity_db`) owns ONLY credentials (`user_id` as scalar reference, `password_hash`, password lifecycle, refresh tokens, Google Login linkage, password recovery codes). | Refactor `identity_db` schema to store credentials mapped to `tenant-service`'s `user_id`. | **BLOCKER** |
| **User ID Identifier Model** | `id` in `identity_db.users` generated on user registration inside Identity Service. | `user_id` is generated/owned by `tenant-service`. No separate `identity_id`. | `tenant-service` generates/owns `user_id`; `identity-service` consumes it for credentials. | **BLOCKER** |
| **Email Service** | Scaffolded as standalone `services/email-service`. | **No standalone Email Service application**. Email delivery belongs to `notification-service`. | Discontinue `email-service`; place email delivery abstraction inside `notification-service`. | **HIGH** |
| **Media Storage Service** | Scaffolded as standalone `services/media-storage-service` with `media_db`. | **No Media Storage application service**. Physical storage is infrastructure; file references owned by domain services; quota policy owned by `tenant-service`. | Remove `media-storage-service` and `media_db`. Domain services hold S3/Local file keys. | **HIGH** |
| **Notification Service** | Removed/scaffolded as email-only. | `notification-service` (`notification_db`) owns template management, in-app notification center, per-recipient read state, and email delivery. | Reinstate `notification-service` with `notification_db`. | **HIGH** |
| **Transactional Outbox** | Excluded in historical ADR 0007 / Kafka docs. | **Mandatory Transactional Outbox**: Database state mutations and Kafka event publishing must be transactionally coordinated via local outbox table. | Add outbox pattern to all event-producing services; update ADR 0007. | **BLOCKER** |
| **Course Lifecycle States** | Draft / Published / Archived in old docs. | Exactly 6 states: `Draft`, `Submitted`, `Published`, `Rejected`, `Archived`, `Disabled`. (`Published` is approval result; no separate "Approved"). | Align Course entity enums and transition state machine. | **HIGH** |
| **Enrollment States** | Active / Completed / Cancelled in old docs. | Exactly 7 states: `NotStarted`, `InProgress`, `Completed`, `Overdue`, `Exempted`, `Withdrawn`, `Halted`. | Align Learning enrollment enums and state transition logic. | **HIGH** |
| **Course Type vs Obligation** | Conflated in early docs. | `courseType` (`PUBLIC` / `PRIVATE`) controls catalog visibility only. `Enrollment.type` (`REQUIRED` / `OPTIONAL`) controls learner obligation. Independent concepts. | Strict separation in data model and business rules. | **HIGH** |
| **Course Disabled Cascade** | Described as synchronous cascade in some docs. | `CourseDisabled` emitted to Kafka via Outbox $\rightarrow$ `learning-service` transitions active enrollments to `Halted`. | Implement asynchronous Outbox event flow for Course Disabled. | **HIGH** |
| **Course Lock Rule** | Not explicitly modeled in code. | Course Lock is set upon the first `Enrollment` and cannot be removed (prevents destructive syllabus mutations). | Model `isLocked` / `lockedAt` in `course-service`. | **MEDIUM** |
| **API Gateway Routes** | Mapped to `ORGANIZATION-COMMERCIAL-SERVICE`, `MEDIA-STORAGE-SERVICE`, `EMAIL-SERVICE`. | Map to `TENANT-SERVICE`, `NOTIFICATION-SERVICE`, remove Media & Email routes. | Update `gateway/api-gateway/src/main/resources/application.yml`. | **HIGH** |
| **PostgreSQL DB Provisioning** | `init-databases.sh` creates `organization_commercial_db`, `media_db`. Missing `tenant_db`, `notification_db`. | `init-databases.sh` must create: `identity_db`, `tenant_db`, `course_db`, `learning_db`, `assessment_db`, `achievement_reporting_db`, `notification_db`, `audit_db`. | Update `init-databases.sh` to 8 exact databases. | **HIGH** |
| **Docker Compose Services** | Orchestrates `postgres`, `kafka`, `eureka-server`, `api-gateway`, `identity-service`, `frontend`. | Add remaining 7 application services as they are implemented. | Update Compose definitions incrementally per phase. | **LOW** |

---

## B. CURRENT $\rightarrow$ TARGET SERVICE MIGRATION MAP

```text
CURRENT FOLDERS (services/)               TARGET APPLICATION SERVICES (Exactly 8)
───────────────────────────               ───────────────────────────────────────
identity-service ────────────────────────► 1. identity-service (Refactored to Credential-only)
organization-commercial-service ─────────► 2. tenant-service (Owns Accounts, Orgs, Subs)
course-service ──────────────────────────► 3. course-service (Owns Syllabus, Moderation)
learning-service ────────────────────────► 4. learning-service (Owns 7-state Enrollments)
assessment-service ──────────────────────► 5. assessment-service (Owns Quizzes, Submissions, Peer Review)
achievement-reporting-service ──────────► 6. achievement-reporting-service (Owns Certs & Reports)
[Restore / Implement] ───────────────────► 7. notification-service (Owns In-App & Email Delivery)
audit-service ───────────────────────────► 8. audit-service (Owns Durable Audit Logs)
media-storage-service ───────────────────► [REMOVED as App Service] (Storage is Infrastructure)
email-service ───────────────────────────► [REMOVED as App Service] (Merged into Notification Service)
```

### Service-by-Service Migration Plan

1. **`services/identity-service`**:
   - *Current Status*: Implemented with full `User` + `RefreshToken` entities in `identity_db`.
   - *Target Action*: **REFACTOR & KEEP**. Strip account profile management (`fullName`, `organizationId`, self-registration profile logic). Redesign to store `credentials` (`user_id`, `password_hash`, `refresh_tokens`, `recovery_codes`). Consumes `user_id` allocated by `tenant-service`.
2. **`services/organization-commercial-service`**:
   - *Current Status*: Scaffold / README only.
   - *Target Action*: **RENAME & BUILD** $\rightarrow$ `services/tenant-service` (`tenant_db`). Master owner of User Accounts, Organizations, Memberships, Invitations, Subscriptions, and Storage Quotas.
3. **`services/course-service`**:
   - *Current Status*: Scaffold / README only.
   - *Target Action*: **BUILD** $\rightarrow$ `services/course-service` (`course_db`). Owns Course, Versions, Modules, Lessons, Material links, Course lock, and Content moderation.
4. **`services/learning-service`**:
   - *Current Status*: Scaffold / README only.
   - *Target Action*: **BUILD** $\rightarrow$ `services/learning-service` (`learning_db`). Owns Enrollments (7 strict states), Progress tracking, Deadlines, and Course assignments.
5. **`services/assessment-service`**:
   - *Current Status*: Scaffold / README only.
   - *Target Action*: **BUILD** $\rightarrow$ `services/assessment-service` (`assessment_db`). Owns Quizzes, Questions, Attempts, Assignment exercises, Submissions, deterministic Rubrics, and Peer Review cycles.
6. **`services/achievement-reporting-service`**:
   - *Current Status*: Scaffold / README only.
   - *Target Action*: **BUILD** $\rightarrow$ `services/achievement-reporting-service` (`achievement_reporting_db`). Owns Certificate issuance snapshots, verification keys, and compliance reporting.
7. **`services/notification-service`**:
   - *Current Status*: Not present in `services/`.
   - *Target Action*: **RESTORE / BUILD** $\rightarrow$ `services/notification-service` (`notification_db`). Owns in-app notification center, per-recipient read state, and email delivery dispatch.
8. **`services/audit-service`**:
   - *Current Status*: Scaffold / README only.
   - *Target Action*: **BUILD** $\rightarrow$ `services/audit-service` (`audit_db`). Owns immutable audit trail and action history.
9. **`services/media-storage-service`**:
   - *Current Status*: Scaffold / README only.
   - *Target Action*: **REMOVE FOLDER**. Physical file storage is infrastructure (local disk / S3). Metadata and storage keys are stored directly in the referencing domain entities (Course Material, Assessment Submission, Certificate). Quota tracking is owned by `tenant-service`.
10. **`services/email-service`**:
    - *Current Status*: Scaffold / README only.
    - *Target Action*: **REMOVE FOLDER**. Merged directly into `notification-service`.

---

## C. DATABASE MIGRATION MAP

| Current Database | Target Database | Owning Service | Migration Required? | Tables to Move / Create / Delete |
| :--- | :--- | :--- | :--- | :--- |
| `identity_db` | `identity_db` | `identity-service` | **Yes (Refactor)** | **Modify**: Refactor `users` table into `credentials` (`user_id UUID PK`, `password_hash`, `failed_attempts`, `locked_until`, `created_at`, `updated_at`). Retain `refresh_tokens`. Delete profile fields (`full_name`, `organization_id`, `role`). |
| `organization_commercial_db` | `tenant_db` | `tenant-service` | **Yes (Create)** | **Create**: `users` / `accounts` (master profile: `id`, `email`, `full_name`, `avatar_url`, `role`, `work_unit`, `status`), `organizations`, `memberships`, `invitations`, `email_verifications`, `plans`, `subscriptions`, `payment_transactions`, `invoices`, `outbox_events`. |
| `course_db` | `course_db` | `course-service` | **Yes (Create)** | **Create**: `courses`, `course_versions`, `modules`, `lessons`, `materials`, `moderation_reports`, `moderation_decisions`, `instructor_violations`, `outbox_events`. |
| `learning_db` | `learning_db` | `learning-service` | **Yes (Create)** | **Create**: `enrollments`, `lesson_progress`, `course_assignments`, `outbox_events`. |
| `assessment_db` | `assessment_db` | `assessment-service` | **Yes (Create)** | **Create**: `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `assignment_exercises`, `assignment_submissions`, `peer_review_assignments`, `peer_review_evaluations`, `outbox_events`. |
| `achievement_reporting_db` | `achievement_reporting_db` | `achievement-reporting-service` | **Yes (Create)** | **Create**: `certificates`, `certificate_templates`, `training_evaluations`, `report_snapshots`, `outbox_events`. |
| *None* | `notification_db` | `notification-service` | **Yes (Create)** | **Create**: `notifications`, `recipient_notifications`, `notification_templates`, `delivery_logs`, `outbox_events`. |
| `audit_db` | `audit_db` | `audit-service` | **Yes (Create)** | **Create**: `audit_logs`. |
| `media_db` | *None* | *N/A* | **Delete DB** | Database removed entirely. |

### Schema Decomposition for `identity_db.users`

```text
CURRENT: identity_db.users (Monolithic)
├── id UUID ───────────────────────────────► TARGET: tenant_db.accounts (Master Account)
├── username VARCHAR(50)                   ├── id UUID PRIMARY KEY (Canonical user_id)
├── email VARCHAR(100) ───────────────────►├── email VARCHAR(100) NOT NULL UNIQUE
├── full_name VARCHAR(100) ───────────────►├── full_name VARCHAR(100)
├── role VARCHAR(20) ─────────────────────►├── role VARCHAR(20) NOT NULL
├── organization_id UUID ─────────────────►├── organization_id UUID
├── enabled BOOLEAN ──────────────────────►├── status VARCHAR(20) (ACTIVE, SUSPENDED, PENDING)
├── created_at, updated_at ───────────────►├── avatar_url, work_unit
                                           └── created_at, updated_at
                                           
├── password_hash VARCHAR(255) ───────────► TARGET: identity_db.credentials (Authentication)
                                           ├── user_id UUID PRIMARY KEY (References tenant_db.accounts.id logically)
                                           ├── password_hash VARCHAR(255) NOT NULL
                                           ├── password_changed_at TIMESTAMP WITH TIME ZONE
                                           └── updated_at TIMESTAMP WITH TIME ZONE
```

---

## D. IDENTITY MIGRATION PLAN

```text
                                 REGISTRATION / INVITATION FLOW
                                 
  [ Client (Browser) ]
          │
          │ 1. POST /api/tenants/register or /api/tenants/invitations/accept
          ▼
  [ Tenant Service (tenant-service) ]
          │
          ├── 1. Validates organization, email, invitation code, quota limits.
          ├── 2. Generates canonical user_id (UUID).
          ├── 3. Persists account record in tenant_db.
          │
          │ 2. Synchronous REST: POST /api/internal/credentials (user_id, password)
          ▼
  [ Identity Service (identity-service) ]
          │
          ├── 1. Hashes password using BCrypt.
          ├── 2. Persists credential in identity_db.credentials.
          └── 3. Returns success to Tenant Service.
```

```text
                                         LOGIN FLOW
                                         
  [ Client (Browser) ]
          │
          │ 1. POST /api/auth/login (email/username, password)
          ▼
  [ Identity Service (identity-service) ]
          │
          │ 2. Synchronous REST: GET /api/internal/accounts/by-identifier?val=...
          ▼
  [ Tenant Service (tenant-service) ]
          │
          ├── Returns: { userId, email, role, organizationId, status: "ACTIVE" }
          │
  [ Identity Service validates: ]
          ├── 1. Account status == ACTIVE (if SUSPENDED -> 403 Forbidden).
          ├── 2. BCrypt.matches(password, credentials.password_hash).
          ├── 3. Issues signed JWT with claims: sub (userId), role, organizationId, email.
          ├── 4. Generates & persists Refresh Token in identity_db.
          └── 5. Returns AuthResponse (accessToken, refreshToken) to Client.
```

### Key Migration Invariants:
1. **User Identifier Ownership**: `tenant-service` allocates and owns `user_id`. `identity-service` never invents a separate `identity_id`.
2. **Stateless Gateway**: The API Gateway does not call `identity-service` or `tenant-service` on every request. It validates the cryptographic signature of the JWT statelessly and propagates verified headers (`X-User-ID`, `X-Organization-ID`, `X-User-Role`, `X-Correlation-ID`).
3. **No Cross-Service DB Access**: `identity-service` queries `tenant-service` via internal REST APIs (`/api/internal/...`) to inspect account status during login/password recovery.

---

## E. DOMAIN OWNERSHIP MATRIX

| Domain Object / Entity | Owner Service | Database | Notes & Invariants |
| :--- | :--- | :--- | :--- |
| **Organization** | `tenant-service` | `tenant_db` | Lifecycle (ACTIVE, SUSPENDED), slug, profile, contact info. |
| **Account / User Profile** | `tenant-service` | `tenant_db` | Master account, email, name, avatar, work unit, role, account status. |
| **Membership & Tags** | `tenant-service` | `tenant_db` | User-Organization links, learner tags/cohorts for bulk operations. |
| **Invitation & Verification** | `tenant-service` | `tenant_db` | Organization invitation codes, email verification tokens. |
| **Plan, Subscription, Quota** | `tenant-service` | `tenant_db` | Tier limits, seat allowances, storage quota rules, active subscription status. |
| **B2B Payment & Invoice** | `tenant-service` | `tenant_db` | Transactions, billing history, payment status, invoices. |
| **User Credential** | `identity-service` | `identity_db` | BCrypt password hash, password update timestamps, failed attempt counters. |
| **Refresh Token** | `identity-service` | `identity_db` | Token rotation hashes, expiration timestamps, revocation states. |
| **Course & Course Version** | `course-service` | `course_db` | Course metadata, catalog visibility (`PUBLIC`/`PRIVATE`), versioning. |
| **Syllabus (Module, Lesson, Material)** | `course-service` | `course_db` | Content hierarchy, lesson ordering, material storage keys (text, video links). |
| **Course Lock** | `course-service` | `course_db` | Irreversible boolean lock set upon the very first enrollment in a course. |
| **Content Moderation & Violations** | `course-service` | `course_db` | Violation reports, admin moderation decisions, instructor strike history. |
| **Enrollment** | `learning-service` | `learning_db` | Exactly 7 states: `NotStarted`, `InProgress`, `Completed`, `Overdue`, `Exempted`, `Withdrawn`, `Halted`. Obligation: `REQUIRED`/`OPTIONAL`. |
| **Learning Progress** | `learning-service` | `learning_db` | Lesson completions, percentage calculation, mandatory material tracking. |
| **Course Assignment (Learner)** | `learning-service` | `learning_db` | Mandatory assignment records assigned to individual/cohort learners with deadlines. |
| **Quiz, Question, Option** | `assessment-service` | `assessment_db` | Quizzes, MCQ questions, options, deterministic answer keys (strictly non-AI). |
| **Quiz Attempt & Score** | `assessment-service` | `assessment_db` | Learner quiz submissions, automated scoring, attempt limits. |
| **Assignment Exercise** | `assessment-service` | `assessment_db` | Open-ended assignment definitions, submission requirements, rubrics. |
| **Assignment Submission** | `assessment-service` | `assessment_db` | Learner file submissions, text submissions, submission timestamps. |
| **Peer Review Cycle & Evaluation** | `assessment-service` | `assessment_db` | 5 peer reviewer allocations, peer scoring rubrics, review completion status, review timeout detection. |
| **Instructor Grade Override** | `assessment-service` | `assessment_db` | Fallback instructor evaluation upon peer review timeout or grade appeal. |
| **Certificate** | `achievement-reporting-service` | `achievement_reporting_db` | Verifiable certificate record, certificate code, issued snapshot, public verify key. |
| **Training Evaluation & Reports** | `achievement-reporting-service` | `achievement_reporting_db` | Organization compliance summaries, progress export reports, learner completion matrices. |
| **In-App Notification & Read State** | `notification-service` | `notification_db` | In-app notification records, recipient unread/read state, notification templates. |
| **Email Delivery Dispatch** | `notification-service` | `notification_db` | SMTP / Mock email delivery engine, transactional email templates, delivery logs. |
| **Audit Log** | `audit-service` | `audit_db` | Durable, append-only log of actor, action, target resource, correlation ID, timestamp. |

---

## F. API & COMMUNICATION MATRIX

| Caller Service | Callee Service | Mechanism | Purpose / Business Flow | Data Exchanged |
| :--- | :--- | :--- | :--- | :--- |
| `tenant-service` | `identity-service` | **REST (Sync)** | User registration / password setup / reset. | `POST /api/internal/credentials` $\rightarrow$ `{ userId, password }` |
| `identity-service` | `tenant-service` | **REST (Sync)** | Login account lookup & status check. | `GET /api/internal/accounts/by-identifier?val=...` $\rightarrow$ `{ userId, email, role, organizationId, status }` |
| `course-service` | `assessment-service` | **REST (Sync)** | Disabling an assessment component when course is modified. | `POST /api/internal/assessments/{id}/status` $\rightarrow$ `{ status: "DISABLED" }` |
| `learning-service` | `assessment-service` | **REST (Sync)** | Evaluating completion eligibility & querying final grade snapshot. | `GET /api/internal/assessments/scores?enrollmentId=...` $\rightarrow$ `{ passed: true, finalScore: 92.5 }` |
| `learning-service` | `achievement-reporting-service` | **REST (Sync)** | Triggering certificate generation once course completion is validated. | `POST /api/internal/certificates/issue` $\rightarrow$ `{ organizationId, userId, courseId, finalScore, completionDate }` |
| `course-service` | `learning-service` | **Kafka (Async Outbox)** | Course is disabled by admin/moderator $\rightarrow$ active enrollments must halt. | Topic: `learnup.course.disabled` $\rightarrow$ Payload: `{ courseId, reason, occurredAt }` |
| `learning-service` | `notification-service` | **Kafka (Async Outbox)** | Mandatory course assigned to learner cohort with deadline. | Topic: `learnup.learning.assignment-created` $\rightarrow$ Payload: `{ assignmentId, organizationId, learnerIds, courseId, dueDate }` |
| `learning-service` | `notification-service` | **Kafka (Async Outbox)** | Course completed by learner. | Topic: `learnup.learning.course-completed` $\rightarrow$ Payload: `{ enrollmentId, organizationId, learnerId, courseId, completionDate }` |
| `assessment-service` | `notification-service` | **Kafka (Async Outbox)** | Peer review allocated to learner or review timeout occurred. | Topic: `learnup.assessment.peer-review-assigned` $\rightarrow$ Payload: `{ reviewAssignmentId, reviewerId, submissionId, deadline }` |
| Any Business Service | `audit-service` | **REST (Sync) / Durable Outbox** | Recording critical governance, moderation, waiver, or administrative mutations. | Payload: `{ actorId, organizationId, action, targetType, targetId, correlationId, details }` |

---

## G. EVENT & OUTBOX PLAN

```text
                            TRANSACTIONAL OUTBOX PATTERN
                            
  ┌────────────────────────────────────────────────────────────────────────┐
  │ Service Database (e.g. course_db, learning_db, assessment_db)          │
  │                                                                        │
  │  BEGIN TRANSACTION                                                     │
  │    1. UPDATE business_table SET status = 'DISABLED'...                 │
  │    2. INSERT INTO outbox_events (id, aggregate_type, payload, status)  │
  │  COMMIT TRANSACTION                                                    │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼ Outbox Publisher (Poller / Background Worker)
                          ┌───────────────────────┐
                          │     Apache Kafka      │
                          └───────────┬───────────┘
                                      │
                                      ▼ Idempotent Consumer (Checks processed_events table)
  ┌───────────────────────────────────┴────────────────────────────────────┐
  │ Downstream Service Database (e.g. learning_db, notification_db)        │
  │                                                                        │
  │  BEGIN TRANSACTION                                                     │
  │    1. Check IF event_id already processed -> Ignore if duplicate       │
  │    2. UPDATE enrollments SET status = 'Halted' WHERE course_id = ...   │
  │    3. INSERT INTO processed_events (event_id, processed_at)            │
  │  COMMIT TRANSACTION                                                    │
  └────────────────────────────────────────────────────────────────────────┘
```

### Justified Domain Event Catalog

| Event Name | Producer Service | Trigger & Source DB Mutation | Consumer Service(s) | Required Payload | Idempotency & Outbox Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`CourseDisabled`** | `course-service` | Course status updated to `DISABLED` in `course_db`. | `learning-service` | `eventId`, `eventType: "CourseDisabled"`, `version: 1`, `occurredAt`, `organizationId`, `data: { courseId, reason }` | **Outbox** in `course_db`. `learning-service` checks `processed_events` and updates matching `InProgress`/`NotStarted` enrollments to `Halted`. |
| **`RequiredAssignmentCreated`** | `learning-service` | Organizer assigns mandatory course in `learning_db`. | `notification-service` | `eventId`, `eventType: "RequiredAssignmentCreated"`, `occurredAt`, `organizationId`, `data: { courseId, learnerIds: [], dueDate }` | **Outbox** in `learning_db`. `notification-service` dispatches in-app notification and email to all targeted learners. |
| **`CourseCompleted`** | `learning-service` | Learner completes all mandatory materials and passes assessments (`learning_db`). | `notification-service` | `eventId`, `eventType: "CourseCompleted"`, `occurredAt`, `organizationId`, `data: { learnerId, courseId, finalScore, completionDate }` | **Outbox** in `learning_db`. `notification-service` delivers completion congratulatory email/notification. *(Certificate issuance is executed via synchronous REST call from Learning to Achievement)*. |
| **`PeerReviewAssigned`** | `assessment-service` | Essay submitted; 5 peer reviewers assigned in `assessment_db`. | `notification-service` | `eventId`, `eventType: "PeerReviewAssigned"`, `occurredAt`, `organizationId`, `data: { reviewerId, submissionId, dueDate }` | **Outbox** in `assessment_db`. `notification-service` notifies peer reviewers. |
| **`PeerReviewTimeout`** | `assessment-service` | Timeout job detects uncompleted peer reviews past deadline in `assessment_db`. | `notification-service` | `eventId`, `eventType: "PeerReviewTimeout"`, `occurredAt`, `organizationId`, `data: { submissionId, instructorId, assignedReviewerIds }` | **Outbox** in `assessment_db`. `notification-service` alerts Instructor to intervene. |

---

## H. IMPLEMENTATION PHASE PLAN

```text
 PHASE DEPENDENCY GRAPH
 
 [ P0: Architecture Baseline & Clean Topology ]
                    │
                    ▼
 [ P1: Tenant Service & Identity Service Refactoring ] (Resolves User/Account vs Credential split)
                    │
                    ▼
 [ P2: Notification & Audit Platform Services ] (Enables in-app/email alerts & durable logs)
                    │
                    ▼
 [ P3: Course Service ] (Course Versioning, Syllabus, Moderation, Course Lock)
                    │
                    ▼
 [ P4: Assessment Service ] (MCQ auto-grade, Quizzes, Submissions, Peer Review cycles)
                    │
                    ▼
 [ P5: Learning Service ] (7-State Enrollments, Progress Tracking, Outbox CourseDisabled listener)
                    │
                    ▼
 [ P6: Achievement & Reporting Service ] (Certificates, Public Verification, Analytics)
                    │
                    ▼
 [ P7: End-to-End System Integration & UI Polish ] (Complete B2B Multi-Tenant Flows)
```

### Phase Breakdown

* **Phase P0: Topology & Infrastructure Alignment**
  * Scope: Clean service folders to match the exact 8-service topology; update `init-databases.sh` and Gateway routes.
  * Prerequisites: Approval of this migration plan.
  * Impact: Renames `services/organization-commercial-service` $\rightarrow$ `services/tenant-service`; removes `media-storage-service` & `email-service`; restores `notification-service`.

* **Phase P1: Master Account & Credential Separation (`tenant-service` & `identity-service`)**
  * Scope: Build `tenant-service` (`tenant_db`) as owner of accounts, organizations, memberships, invitations, subscriptions. Refactor `identity-service` (`identity_db`) to store credentials only (`user_id`, `password_hash`).
  * Source of Truth: `LearnUP_Service_Architecture.docx` & `LearnUP_UseCase.docx`.
  * Tests: Registration flow (Tenant $\rightarrow$ Identity), Login flow (Identity $\rightarrow$ Tenant status verification), Token issuance, Role validation.

* **Phase P2: Supporting Capabilities (`notification-service` & `audit-service`)**
  * Scope: Implement `notification-service` (`notification_db` for in-app notifications and email dispatch) and `audit-service` (`audit_db` for immutable audit trails).
  * Source of Truth: `LearnUP_Service_Architecture.docx` & `LearnUP_QuyTacNghiepVu.docx`.

* **Phase P3: Course Service (`course-service`)**
  * Scope: Course catalog, Course Versioning, Syllabus hierarchy (Modules, Lessons, Materials), Content Moderation, Violation Reports, and Course Lock logic.
  * Source of Truth: `LearnUP_UseCase.docx` & `LearnUP_QuyTacNghiepVu.docx`.

* **Phase P4: Assessment Service (`assessment-service`)**
  * Scope: Quizzes, Questions, deterministic MCQ auto-scoring, Assignment exercises, Submissions, Rubrics, Peer Review cycles (5 reviewers, completion rule, timeout routing to instructor).
  * Source of Truth: `LearnUP_UseCase.docx` & `LearnUP_QuyTacNghiepVu.docx`.

* **Phase P5: Learning Service (`learning-service`)**
  * Scope: 7-state Enrollments, mandatory material progress tracking, Learner course assignments with deadlines, and Kafka Outbox listener for `CourseDisabled` $\rightarrow$ `Halted`.
  * Source of Truth: `LearnUP_UseCase.docx` & `LearnUP_QuyTacNghiepVu.docx`.

* **Phase P6: Achievement & Reporting Service (`achievement-reporting-service`)**
  * Scope: Certificate issuance snapshots, public verification keys, training evaluations, compliance reports, and CSV export.
  * Source of Truth: `LearnUP_UseCase.docx` & `LearnUP_QuyTacNghiepVu.docx`.

* **Phase P7: End-to-End Platform Integration & Frontend Delivery**
  * Scope: Connect React Frontend to Gateway for all 5 business domains; verify end-to-end multi-tenant workflows, role guards, and outbox event streams.

---

## I. LEGACY CODE TO REMOVE / REPLACE

1. **Directories to Remove**:
   - `services/media-storage-service` (Physical storage is infrastructure, not an application service).
   - `services/email-service` (Merged into `notification-service`).
2. **Directory to Rename**:
   - `services/organization-commercial-service` $\rightarrow$ `services/tenant-service`.
3. **Database Names to Update in `init-databases.sh`**:
   - Remove `media_db` and `organization_commercial_db`.
   - Add `tenant_db` and `notification_db`.
4. **Code Entities to Refactor in `identity-service`**:
   - Refactor `User.java` to `Credential.java` (remove `fullName`, `role`, `organizationId`).
   - Refactor `V1__init_identity_schema.sql` (remove account fields from `users` table).
5. **Gateway Configuration to Update**:
   - Replace `/api/organizations/**`, `/api/subscriptions/**`, `/api/payments/**` route pointing to `ORGANIZATION-COMMERCIAL-SERVICE` with route pointing to `TENANT-SERVICE`.
   - Remove `/api/media/**` and `/api/email/**` routes.
   - Add `/api/notifications/**` route pointing to `NOTIFICATION-SERVICE`.
6. **Documentation / ADR Updates**:
   - Update `docs/adr/0007-technology-exclusions.md` and `docs/architecture/event-driven.md` to mandate the **Transactional Outbox** pattern for all asynchronous domain events.

---

## J. RULES THAT MUST NEVER BE VIOLATED

1. **Topology Invariant**: Exactly **8 application services** (5 Business: `tenant-service`, `course-service`, `learning-service`, `assessment-service`, `achievement-reporting-service`; 3 Supporting: `identity-service`, `notification-service`, `audit-service`).
2. **Strict Encapsulation**: Each service owns its database exclusively. Zero cross-service database queries, zero cross-database foreign keys, zero shared JPA entities.
3. **Account vs Credential Boundary**: `tenant-service` owns the Master Account/User record; `identity-service` owns Credentials and password lifecycle only.
4. **Single User Identifier**: `user_id` (UUID) allocated by `tenant-service` is the universal user key. No `identity_id`.
5. **Canonical Tenant**: `organizationId` (UUID) is the sole tenant identifier.
6. **Exactly Four Authenticated Roles**: `ADMIN`, `ORGANIZER`, `INSTRUCTOR`, `LEARNER`. (Guest is unauthenticated, not a role).
7. **Stateless Gateway**: API Gateway validates JWT cryptographically without per-request database lookups and injects trusted `X-*` headers.
8. **Semantic Separation**:
   - `courseType` (`PUBLIC`/`PRIVATE`) = Catalog visibility only.
   - `Enrollment.type` (`REQUIRED`/`OPTIONAL`) = Learner obligation only.
   - "Course assignment for Learner" = `learning-service` (`Enrollment`).
   - "Assignment exercise" = `assessment-service` (`Submission`/`Rubric`).
9. **Course Lifecycle**: Exactly 6 states: `Draft`, `Submitted`, `Published`, `Rejected`, `Archived`, `Disabled`.
10. **Enrollment Lifecycle**: Exactly 7 states: `NotStarted`, `InProgress`, `Completed`, `Overdue`, `Exempted`, `Withdrawn`, `Halted`.
11. **Course Lock**: Set upon the first enrollment and is irreversible.
12. **Course Disabled Cascade**: Course Disabled emits `CourseDisabled` via Outbox $\rightarrow$ Learning Service updates active enrollments to `Halted`.
13. **Transactional Outbox**: All domain event publishing must be transactionally coordinated with the local database mutation via an outbox table.
14. **Idempotent Consumers**: All Kafka consumers must verify event processing idempotency.
15. **No AI / Out-of-Scope Tech**: Zero AI/ML/LLM grading or tutoring, no Redis, no Next.js, no Elasticsearch, no separate Email/Media microservices.

---

## K. BLOCKERS BEFORE CODING

```text
DO NOT START IMPLEMENTATION UNTIL THESE ARE RESOLVED:
```

1. **Framework Confirmation for Business Services**: Formal confirmation on whether each of the 5 business services + 3 supporting services will be developed in **Spring Boot (Java 21)** or **NestJS (TypeScript)**.
2. **Phase Approval**: Confirmation to proceed with Phase P0 (Topology Alignment) and Phase P1 (Tenant Service Creation & Identity Service Credential Refactoring).

---

# Bottom Line

### 1. What must be changed before P8 implementation?
1. The service topology must be adjusted to the exact **8 application services** (rename to `tenant-service`, remove `media-storage-service` & `email-service`, restore `notification-service`).
2. The `identity-service` must be refactored so it does not own the account profile, and `tenant-service` must be built to own user accounts, organizations, and memberships.
3. Database initialization (`init-databases.sh`) and Gateway routes must be aligned with the 8 target databases and service names.

### 2. What existing code can safely be preserved?
* **`gateway/api-gateway`**: Spring Cloud Gateway routing logic, JWT signature validation filter, CORS configuration, error handling, and header injection.
* **`infrastructure/eureka-server`**: Eureka Service Discovery server.
* **`infrastructure/kafka`**: KRaft message broker container and networking.
* **`libraries/java-common` & `libraries/ts-common`**: `RequestContextHolder`, `CurrentUser`, `OrganizationContext`, `UserRole` (4 roles), `ApiResponse`, `PageResponse`, `ApiError`, `BusinessException`, `EventEnvelope`, and `UserContextFilter`.
* **`frontend/web`**: React 18 + Vite foundation, `AuthContext`, token storage, Axios refresh interceptor, and route guards.

### 3. What existing code must be refactored or replaced?
* **`services/identity-service`**: Must be refactored to remove account ownership (`fullName`, `role`, `organizationId`, user registration logic) and converted to a pure credential management service (`user_id`, `password_hash`, `refresh_tokens`).
* **`identity_db` Schema Migration**: Refactor `users` table to `credentials` table.
* **Architecture Docs**: Update to mandate the Transactional Outbox pattern.

### 4. What target service/database structure should Antigravity implement?
* **5 Business Services**:
  1. `tenant-service` $\rightarrow$ `tenant_db`
  2. `course-service` $\rightarrow$ `course_db`
  3. `learning-service` $\rightarrow$ `learning_db`
  4. `assessment-service` $\rightarrow$ `assessment_db`
  5. `achievement-reporting-service` $\rightarrow$ `achievement_reporting_db`
* **3 Supporting / Platform Services**:
  6. `identity-service` $\rightarrow$ `identity_db`
  7. `notification-service` $\rightarrow$ `notification_db`
  8. `audit-service` $\rightarrow$ `audit_db`

### 5. What exact sequence should implementation follow to minimize rework?
$$\text{P0 (Topology Alignment)} \longrightarrow \text{P1 (Tenant \& Identity Refactoring)} \longrightarrow \text{P2 (Notification \& Audit)} \longrightarrow \text{P3 (Course)} \longrightarrow \text{P4 (Assessment)} \longrightarrow \text{P5 (Learning)} \longrightarrow \text{P6 (Achievement \& Reporting)} \longrightarrow \text{P7 (Integration \& UI)}$$
