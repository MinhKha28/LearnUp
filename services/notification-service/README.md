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
  * Settings: `ENROLLMENT_EVENTS_CONSUMER_ENABLED` (default `false`; Compose sets `true`), `SPRING_KAFKA_BOOTSTRAP_SERVERS`, `ENROLLMENT_EVENTS_GROUP_ID`, `ENROLLMENT_EVENTS_TOPIC`, `ENROLLMENT_EVENTS_MAX_AGE` (72h), `ENROLLMENT_EVENTS_RETRY_ATTEMPTS` (5), `ENROLLMENT_EVENTS_RETRY_INITIAL_BACKOFF` (1s), `ENROLLMENT_EVENTS_RETRY_MAX_BACKOFF` (30s), `ENROLLMENT_EVENTS_CLIENT_TIMEOUT_MS` (3000), `ENROLLMENT_EVENTS_DEFAULT_TIME_ZONE` (Asia/Ho_Chi_Minh), `ENROLLMENT_EVENTS_CLAIM_LEASE` (2m), `ENROLLMENT_EVENTS_START_RETRY_INTERVAL` (10s), `ENROLLMENT_EVENTS_DLT_PARTITIONS` (3), `ENROLLMENT_EVENTS_DLT_REPLICAS` (1), `TENANT_SERVICE_URL`, `COURSE_SERVICE_URL`. Compose forwards all of them.
  * Kafka down at start-up: the service starts anyway (the notification API does not depend on Kafka) and the consumer is started again every `ENROLLMENT_EVENTS_START_RETRY_INTERVAL` until it runs.
  * Two handlers on one event (two instances during a rebalance, or a consumer evicted while it still runs): each delivery is claimed with `SELECT ... FOR UPDATE` before anything is sent (status `PROCESSING`), so only one of them sends; a claim older than `ENROLLMENT_EVENTS_CLAIM_LEASE` is taken over.
* **Consumed Events**:
  * `learnup.tenant.user-invited`
  * `learnup.tenant.user-created`
  * `learnup.course.published`
  * `learnup.course.disabled`
  * `learnup.learning.course-completed`
  * `learnup.assessment.passed`
  * `learnup.certificate.issued`

## Notification list API

`GET /api/v1/notifications` returns a nullable `link` for each item; `null` means the notice has no valid internal destination.

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

### The look of the e-mails

Every e-mail this service writes (Course submitted, Course decision, ownership transfer, enrollment events, peer
review hand-out) is one card built by `mail/EmailLayout`: the LearnUP logo, a badge, the heading, the greeting, optional
details, a marked box, a button and a footer. Tables and inline styles only, so mail clients draw it alike. Every text
handed to it is plain text and is escaped there; a link becomes a button only when it is `http` or `https`.

The logo travels inside the message: a body that shows `<img src="cid:learnup-logo">` gets
`resources/mail/learnup-logo-light.png` attached inline by `EmailDeliveryService` (a missing file costs the picture,
not the mail).

Other services send plain text to `/email/send`. For the template codes listed in `mail/PlainEmailFraming`
(`ASSIGNMENT_FINALIZED`, `PEER_REVIEW_REMINDER`, `PEER_REVIEW_WAIVED`, `IDENTITY_PASSWORD_RECOVERY`) the text is set in
the same card: the subject becomes the heading, a first line `Xin chào {name},` the greeting, blank-line separated
paragraphs the text, and a line that is only an `http(s)` link a button. Another template code, and a body that already
is HTML, go out as they came. To give a new plain-text e-mail the card, add its code to `PlainEmailFraming`.

### Password recovery confidentiality

Identity owns reset-token generation, hashing, eligibility and lifecycle.
Notification only sends the supplied message. Template code
`IDENTITY_PASSWORD_RECOVERY` forces the fixed subject `LearnUP - Đặt lại mật khẩu`
for SMTP and persisted/API metadata. Email bodies are never stored in `email_logs`;
SMTP error details, recipient addresses, subjects and bodies are not written to
application dispatch logs. Other templates keep their original subjects; their bodies
are set in the e-mail card when they are listed in "The look of the e-mails" below.
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

## Finalized submission result notices (NEW BR-254, UC32.3)

The independent `SubmissionFinalized` v1 consumer reads
`learnup.assessment.submission-finalized` with group
`notification-submission-finalized-v1`. Its
[contract](../../contracts/events/assessment-submission-finalized.md) describes the
required decimal-string payload, Vietnamese content and rollout. This PR adds no
Assessment producer and keeps generic notification/email REST APIs.

| Variable | Default | Purpose |
| --- | --- | --- |
| `SUBMISSION_FINALIZED_CONSUMER_ENABLED` | `false` (Compose: `true`) | Enable this independent consumer. |
| `SUBMISSION_FINALIZED_TOPIC` | `learnup.assessment.submission-finalized` | Source; DLT is source plus `.DLT`. |
| `SUBMISSION_FINALIZED_GROUP_ID` | `notification-submission-finalized-v1` | Consumer group. |
| `SUBMISSION_FINALIZED_RETRY_ATTEMPTS` | `10` | Total attempts including the first. |
| `SUBMISSION_FINALIZED_RETRY_INITIAL_MS` | `1000` | Initial exponential retry delay. |
| `SUBMISSION_FINALIZED_RETRY_MAX_MS` | `30000` | Maximum retry delay; also the wait after a failed confirmed DLT publication. |
| `SUBMISSION_FINALIZED_START_RETRY_MS` | `10000` | Retry starting the listener while unavailable. |
| `SUBMISSION_FINALIZED_DLT_PARTITIONS` | `3` | DLT partition count. |
| `SUBMISSION_FINALIZED_DLT_REPLICAS` | `1` | DLT replication factor. |
| `LEARNUP_FRONTEND_BASE_URL` | Empty in application; Compose: `http://localhost:3000` | Required when enabled; absolute http(s), no credentials/query/fragment. |

`learnup.frontend-base-url` backs the frontend base URL. A deployment subpath and
trailing slash are supported. The proposed result URL is
`{base}/learner/courses/by-course/{courseId}/results`. Deployment order is
**consumer PR-1 → frontend resolver PR-3 → producer PR-2**. Compose defaults the
base URL to `http://localhost:3000` for local development, matching its published
frontend port. Production deployments must explicitly set the public frontend URL.
Outside Compose, the application has no default and requires the URL when this
consumer is enabled.

The historical `enrollment_event_deliveries` table is reused with null
`enrollment_id`, one row per event/learner/channel. There is no migration, age-based
discard or ledger deletion. In-app persistence is independent of Tenant and commits
with its ledger `SENT` state after a locked ownership recheck. Tenant eligibility
and email-address lookup gate email only. Fresh unfinished claims remain retryable;
stale workers cannot overwrite newer completion. The existing
`ENROLLMENT_EVENTS_CLAIM_LEASE` (2m) and `ENROLLMENT_EVENTS_CLIENT_TIMEOUT_MS` (3000)
also apply to this reused ledger/Tenant client.

Disabled mail returns **SIMULATED**, recorded as terminal ledger **SENT**; enabling
mail later does not resend it. SMTP stays at least once: a crash after acceptance
but before email-log/ledger completion can resend. Sender acceptance is not inbox
arrival. Missing/deleted/deactivated recipients and missing addresses skip email;
transient Tenant/SMTP failures retry email while preserving in-app delivery.
A permanent channel refusal remains `FAILED` with its fixed reason. While another
channel is transient, the record retries normally; automatic retries skip a channel
already `SENT`, `SKIPPED` or `FAILED/TENANT_REJECTED`. Once no transient work remains,
a permanent refusal goes to the DLT. Retry exhaustion still applies. Poison events
go directly to the DLT. Claim locking and atomic in-app persistence are unchanged.

Only this factory enables the blocking delivery-attempt header. Attempt 1 allows
reclaiming `FAILED` rows; attempts above 1 suppress stored permanent refusals.
Operator replay means re-publishing the original key/value to the source topic as
a new record, preserving `eventId`, not seeking the original offset. No replay
script is provided. The new record starts at attempt 1 and can retry permanent
email failures after their cause is repaired; already sent in-app notices stay
unchanged. A consumer restart or transfer to fresh retry state can also reset the
attempt to 1 and cause one extra permanent-channel attempt per reset.

DLT publication must succeed before recovery advances the source offset.
`setResetStateOnRecoveryFailure(false)` preserves retry state after failed DLT
publication, preventing repeated permanent email attempts. After either a permanent
failure or exhausted transient retries, a failed confirmed DLT publication waits
`SUBMISSION_FINALIZED_RETRY_MAX_MS` before rethrowing the original publication
failure. The wait is interruptible and stops when the container stops. Successful
DLT publication adds no wait. All partitions handled by this consumer thread remain
blocked while waiting. Retain ledger rows throughout the supported replay horizon.

Only this consumer validates the recovery timing envelope at startup when enabled:

`max.block.ms + effective DLT confirmation timeout + retryMaxMs + pollTimeout + processing headroom < max.poll.interval.ms`

The confirmation timeout is the larger of producer `delivery.timeout.ms + 5000`
and 30000 ms. With Kafka/container defaults the budget is
`60000 + 125000 + 30000 + 5000 + 30000 = 250000 < 300000 ms`.
Producer/consumer overrides are read from their factories. An unsafe budget fails
startup with each component named; the recovery delay is never clipped. No new
environment variable is needed. The named 30-second processing headroom is an
allowance, not an enforced listener deadline; validation covers the recovery
envelope only.

Tenant defaults to 3-second connect/read timeouts and SMTP to 5-second
connect/read/write timeouts. These configured limits apply per operation, not to
the total attempt. Delivery-row `SELECT ... FOR UPDATE` and handler transactions
have no configured statement, lock or transaction timeout, so an attempt has no
enforced total deadline. If processing exceeds `max.poll.interval.ms`, the consumer
leaves the group and the record is redelivered. The existing ledger skips completed
deliveries and prevents duplicate committed in-app notices; SMTP retains the
at-least-once limitation described above. Bounding total notification-handler
attempt time is a separate follow-up. Enrollment/course factories are unchanged.

Merge this follow-up before the Assessment SubmissionFinalized producer PR.

No grader or finalization comments enter either channel or metadata. Titles and
names are escaped by `EmailLayout`. This consumer does not call Learning or Course.
Existing consumers' DLT settings and Course delivery transactions are unchanged.

Verification uses Java 21, H2 with Flyway, and EmbeddedKafka without Docker. Coverage
includes replay, channel failures, stale claims, atomic in-app delivery, failed DLT
publication without offset commit, and API startup before Kafka is available followed
by recovery. These tests do not prove real PostgreSQL locking or real inbox delivery.

Recovery back-off verification uses the normal `mvn test` / `mvn clean verify`
suite with a 1-second configured wait. It checks publication spacing, uncommitted
source offsets, permanent-email suppression, stop/interruption, successful recovery
without an extra wait, and enabled-only startup validation. The optional local
90-second measurement uses the default 30-second delay and is excluded from normal
and CI runs:

```sh
mvn -B -ntp -Pdlt-default-delay-measurement -Dtest=SubmissionFinalizedEventListenerKafkaTest test
```

The measurement uses listener/publication counters, `System.nanoTime` and a Logback
appender counting rendered message/stack-trace lines on the listener thread. The
historical observation before recovery back-off was about 1.9 attempts/s and 126
log lines per publication (about 240 lines/s). New local measurements are recorded
in this change's PR description; these are EmbeddedKafka observations, not a
production throughput guarantee. Local results after recovery back-off:

| Recovery wait / failure | Window | Publications/s | Rendered log lines/s | Shortest adjacent interval |
| --- | --- | --- | --- | --- |
| 1s / permanent | 10.000s | 0.900 | 116.90 | 1.012s |
| 1s / exhausted transient | 5.001s | 0.800 | 102.38 | 1.016s |
| 30s / exhausted transient | 90.014s | 0.022 | 2.84 | 30.061s |

The default-delay run stopped the container during its wait in 54 ms. These rates
include consumer polling overhead and fixed-window effects; they are not precise
scheduling guarantees. Deployment monitoring should alert on DLT publication failure.

Notification Kafka consumers never auto-create topics, even if external consumer properties request it. Source topics must be provisioned by their producer relays; Notification's existing `NewTopic` beans provision the DLTs. A missing source topic is waited for, not created, and consumption resumes when it is provisioned.
