# Notification Service (`services/notification-service`)

## 1. Overview
The **Notification Service** is one of the 3 finalized LearnUP Supporting/Platform Services. It manages in-app user notifications, system alert broadcasts, direct email delivery integrations (SMTP / notification provider), and user notification preferences across all organizations and roles.

---

## 2. Technology Stack & Runtime
* **Framework**: Spring Boot (Java 21) or NestJS (TypeScript)
* **Database**: PostgreSQL (`notification_db`)
* **Eureka Service Name**: `NOTIFICATION-SERVICE`
* **Messaging**: Apache Kafka Consumer (listens to cross-domain events) & Transactional Outbox

---

## 3. Key Responsibilities
* **In-App Notification Center**: Persisting and querying user notifications, marking notifications as read/unread, unread count queries.
* **Direct Email Dispatching**: Generating and delivering transactional emails (invitations, password resets, enrollment notices, overdue alerts, certificate awards) without needing a standalone email microservice.
* **Notification Templates**: Rendering localized message templates for both in-app banners and emails.
* **Event Consumption**: Consuming domain events from Kafka (e.g. `learnup.tenant.user-invited`, `learnup.learning.course-completed`, `learnup.assessment.passed`) and dispatching corresponding notifications.

---

## 4. Database Entities (`notification_db`)
* `Notification` (`id`, `organizationId`, `recipientUserId`, `title`, `message`, `type`, `channel`, `isRead`, `readAt`, `createdAt`)
* `NotificationTemplate` (`id`, `templateCode`, `subjectTemplate`, `bodyTemplate`, `channel`, `createdAt`)
* `EmailLog` (`id`, `recipientEmail`, `subject`, `status`, `errorMessage`, `sentAt`)
* `EnrollmentEventDelivery` (`id`, `eventId`, `eventType`, `organizationId`, `enrollmentId`, `recipientUserId`, `channel` EMAIL or IN_APP, `status` PENDING, SENT, FAILED or SKIPPED, `attempts`, `lastError` (a fixed code), `occurredAt`, `sentAt`): what was sent for which learning event; unique on (`eventId`, `recipientUserId`, `channel`)

---

## 5. Non-Responsibilities (Strict Service Boundaries)
* **User Credential / Password Management**: Owned by **Identity Service** (`identity_db`).
* **Tenant & Account Master**: Owned by **Tenant Service** (`tenant_db`).
* **Course / Learning / Assessment Domain Rules**: Owned by respective business services.
* **Audit Trail Storage**: Immutable compliance and action logging is owned by **Audit Service** (`audit_db`).

---

## 6. Event Interactions
* **Learning enrollment events** (`learnup.learning.enrollment-events`): tells the Learner in the app and by e-mail about `EnrollmentAssigned`, `EnrollmentDueDateExtended` and `EnrollmentExempted`; `LearnerWithdrew` writes to nobody. Retry with backoff, then `learnup.learning.enrollment-events.DLT`. Contract and rules: `contracts/events/learning-enrollment-events.md`.
  * Settings: `ENROLLMENT_EVENTS_CONSUMER_ENABLED` (default `false`; Compose sets `true`), `SPRING_KAFKA_BOOTSTRAP_SERVERS`, `ENROLLMENT_EVENTS_GROUP_ID`, `ENROLLMENT_EVENTS_TOPIC`, `ENROLLMENT_EVENTS_MAX_AGE` (72h), `ENROLLMENT_EVENTS_RETRY_ATTEMPTS` (5), `ENROLLMENT_EVENTS_RETRY_INITIAL_BACKOFF` (1s), `ENROLLMENT_EVENTS_RETRY_MAX_BACKOFF` (30s), `ENROLLMENT_EVENTS_CLIENT_TIMEOUT_MS` (3000), `ENROLLMENT_EVENTS_DEFAULT_TIME_ZONE` (Asia/Ho_Chi_Minh), `TENANT_SERVICE_URL`, `COURSE_SERVICE_URL`.
* **Consumed Events**:
  * `learnup.tenant.user-invited`
  * `learnup.tenant.user-created`
  * `learnup.course.published`
  * `learnup.course.disabled`
  * `learnup.learning.course-completed`
  * `learnup.assessment.passed`
  * `learnup.certificate.issued`

## Private transactional email API

`POST /api/v1/notifications/email/send` (legacy `/api/notifications/email/send`)
accepts `recipientEmail`, `subject`, `body` and optional `templateCode`. The response
is HTTP 201 with `ApiResponse<EmailLogResponse>`; callers must inspect
`data.status`, not just the HTTP status:

- `SENT`: the configured SMTP sender accepted the send operation. This is not an
  inbox-arrival guarantee.
- `FAILED`: SMTP delivery failed or mail is enabled but no sender is available.
  Error messages contain fixed diagnostic text, never SMTP response bodies.
- `SIMULATED`: `LEARNUP_MAIL_ENABLED=false` (the default); no message was sent.

Both email send aliases and both `GET .../email/logs` aliases require
`X-Internal-Key`. Configure `INTERNAL_SERVICE_KEY` explicitly with a private,
non-default value of at least 32 UTF-8 bytes, shared with legitimate Identity and
Tenant callers. Missing/unsafe configuration prevents startup. Never put this
key in frontend configuration or source control. Requests containing user ID,
Organization, role or Authorization headers are rejected, even with a valid key.
In-app Notification APIs retain their existing separate behavior; this change is
not a general authentication redesign of those APIs.

Use private service networking (`http://notification-service:8082` in Compose),
not a public host-published port. Forward an optional canonical UUID in
`X-Correlation-ID`; other values are replaced, not echoed or logged. Tenant's
existing relay already supplies the internal key and uses the supported legacy
route. Its current mock-mode behavior treats `SIMULATED` as non-failed; operators
must explicitly enable mail for real delivery.

### Password recovery confidentiality

Identity owns reset-token generation, hashing, eligibility and lifecycle.
Notification only sends the supplied message. Template code
`IDENTITY_PASSWORD_RECOVERY` forces the fixed subject `LearnUP password recovery`
for SMTP and persisted/API metadata. Email bodies are never stored in `email_logs`;
SMTP error details, recipient addresses, subjects and bodies are not written to
application dispatch logs. Other templates keep their original subjects/bodies.
Email logging endpoints return metadata only, through the authenticated channel.
Do not enable JavaMail debug, HTTP body/header tracing or proxy request capture:
recovery bodies contain bearer-style reset links. JavaMail debug is off by default.
This does not sanitize historical logs or control external SMTP provider retention.

### Local SMTP configuration

Set `INTERNAL_SERVICE_KEY` privately, then configure `SPRING_MAIL_HOST`,
`SPRING_MAIL_PORT` and `LEARNUP_MAIL_FROM` for a disposable local SMTP receiver.
Set `LEARNUP_MAIL_ENABLED=true` for actual SMTP traffic. Set
`SPRING_MAIL_USERNAME`, `SPRING_MAIL_PASSWORD`, `SPRING_MAIL_SMTP_AUTH` and
`SPRING_MAIL_SMTP_STARTTLS_ENABLE` as required by a real SMTP provider; never
commit their values. Connection/read/write timeouts default to 5000 ms and can
be configured with `SPRING_MAIL_SMTP_CONNECTION_TIMEOUT`,
`SPRING_MAIL_SMTP_TIMEOUT` and `SPRING_MAIL_SMTP_WRITE_TIMEOUT`.

Run `mvn test` / `mvn clean verify` with Java 21. Tests use synthetic credentials
and an isolated H2 database; mocked JavaMailSender tests do not prove inbox delivery.
