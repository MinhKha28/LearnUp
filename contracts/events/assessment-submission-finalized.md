# SubmissionFinalized result notices

NEW BR-254 requires notifying the Learner after the Instructor finalizes a submission
(UC32.3). Its legacy equivalent is OLD BR-207. NEW BR-255 (OLD BR-322) governs the
explanatory comment when the final score differs from the aggregate. Comments belong
in the authorized result view, never in this event or its notices.

## Transport and ownership

| Setting | Value |
| --- | --- |
| Producer | assessment-service |
| Event type / version | SubmissionFinalized / 1 |
| Topic | learnup.assessment.submission-finalized |
| Kafka key | learnerId |
| Notification group | notification-submission-finalized-v1 |
| Dead-letter topic | learnup.assessment.submission-finalized.DLT |

This is a dedicated notification event, separate from LearnerAssessmentStatusChanged.
Notification never queries Learning to build this notice. The producer must write the
event in the successful finalize transaction and reuse its outbox row ID on every
publication attempt. One event has exactly one immutable learner and organization.

Envelope: [canonical v1](event-envelope.schema.json).
Validation: [event schema](assessment-submission-finalized.schema.json).
Example: [SubmissionFinalized](submission-finalized.example.json).

## Required fields

Every field below is required; there are no optional v1 fields.

| Field | Type and meaning |
| --- | --- |
| eventId | Canonical UUID; stable outbox ID and logical deduplication key. |
| eventType | String SubmissionFinalized. |
| version | Integer 1. |
| occurredAt | ISO-8601 UTC timestamp ending in Z; occurrence of finalization. |
| organizationId | Canonical organization UUID; sole tenant identifier. |
| producer | String assessment-service. |
| data | Object containing the fields below. |
| data.learnerId | Canonical UUID; recipient user and Kafka key. |
| data.submissionId | Canonical UUID; finalized submission. |
| data.assessmentId | Canonical UUID; Assignment identity. |
| data.assessmentTitle | Nonblank title snapshot, at most 200 characters. |
| data.finalScore | Decimal string, 0–100, at most two fractional digits, no exponent or leading zeros. |
| data.maxScore | Decimal string exactly "100.00" in v1. |
| data.courseId | Canonical UUID; resolver route input. |
| data.finalizedAt | ISO-8601 UTC timestamp ending in Z; stored finalization time. |

The final score is stored as numeric(5,2); decimal strings preserve it exactly.
The maximum is the business scale 100, not the Rubric raw-points total, and is
not a separate stored Assessment column. Producers must omit grader comments,
finalization comments, email addresses, display names, enrollmentId and URLs.

The consumer reads and validates only the fields above: envelope dispatch/provenance,
ledger identity/time/scope, recipient, message title/score and explicit metadata.
Unknown event types are ignored; unsupported SubmissionFinalized versions are poison.
Unknown payload fields are ignored and never copied into messages or metadata.
The canonical schema constrains root fields; the payload allows additive fields.

## Delivery and idempotency

Notification reuses enrollment_event_deliveries despite its historical name.
enrollment_id is NULL; recipient_user_id is learnerId; uniqueness is
(event_id, recipient_user_id, channel), with one IN_APP and one EMAIL obligation.
SENT and SKIPPED are terminal; a redelivery retries unfinished channels only.
No age-based discard or ledger deletion applies to these result notices.

Claims use row locking and the existing configurable lease. A fresh unfinished claim
is retryable. In-app insertion and SENT commit together after a locked ownership
recheck using the claim timestamp and attempt number. A stale handler cannot insert
or overwrite a newer state.

In-app persistence is independent of Tenant. Email looks up the recipient through
Tenant using organization scope and internal authentication. Missing, deleted or
deactivated recipients become EMAIL SKIPPED with RECIPIENT_UNAVAILABLE; no address
becomes SKIPPED with NO_EMAIL. Tenant timeouts, 5xx, 408 and 429 retry; permanent
refusal is stored as FAILED with its permanent reason. A transient failure on the
other channel still retries; automatic retries do not repeat a stored permanent
channel failure. When no transient work remains, the record goes to the DLT.
Failed email does not undo or repeat a committed in-app notice.

Email remains at least once: SMTP acceptance can precede a crash before email-log
or ledger completion, so replay can resend it. Leases cannot fence an external SMTP
operation. Disabled mail returns SIMULATED and is recorded as ledger SENT, matching
existing service semantics; enabling mail later does not automatically resend it.
SENT means sender acceptance, not inbox arrival.

Ten total attempts use exponential backoff from 1s to a 30s cap. Retry exhaustion
still goes to the DLT; a permanent outcome does not shortcut another channel's
transient retry budget. Poison goes directly to the DLT. DLT publication must
succeed before recovery; failed publication leaves the source record unrecovered.
The dedicated error handler preserves blocking retry state on recovery failure.
After a failed confirmed DLT publication, it waits the configured maximum retry
back-off (default 30s) before rethrowing the original publication failure. This
applies to permanent failures and exhausted transient retries. Successful DLT
publication adds no wait; interruption/container stop ends the wait promptly.
The wait blocks partitions assigned to that consumer thread. Enabled-consumer
startup validation checks the recovery timing envelope against max.poll.interval.ms;
its processing headroom is an allowance, not an enforced total attempt deadline.
Offset management is container BATCH with automatic commits disabled. Event fields,
retry counts, channel suppression, ownership safeguards and replay are unchanged.

The dedicated listener uses the blocking delivery-attempt header. Automatic retries
(attempt above 1) suppress FAILED/TENANT_REJECTED; first deliveries can reclaim it.
Operator replay re-publishes the event key/value as a new source-topic record,
preserving eventId. This starts at attempt 1, retries permanent email failures as
before, and skips already SENT in-app. No replay script is provided. Restart/new
consumer retry state can also reset attempt to 1, permitting an extra permanent
channel attempt per reset. Retain ledger rows through every supported replay horizon.
Logs use fixed codes and delivery coordinates, never payload or comment text.

## Result content and resolver

In-app type: ASSIGNMENT_RESULT. Email template code: ASSIGNMENT_FINALIZED.
Title: Kết quả bài tập đã được công bố

In-app body:
Bài tập «{assessmentTitle}» đã được chốt điểm. Điểm của bạn: {finalScore}/{maxScore}. Xem chi tiết trong kết quả khóa học.

Email subject: LearnUP - Kết quả bài tập đã được công bố

Email paragraphs:
- Xin chào {fullName}, (fallback: Xin chào học viên,)
- Kết quả bài tập «{assessmentTitle}» đã được công bố.
- Điểm của bạn: {finalScore}/{maxScore}.
- Bạn có thể xem chi tiết trong kết quả khóa học trên LearnUP.
- Button: Xem kết quả
- LearnUP footer

EmailLayout escapes the title and greeting. Scores use Vietnamese decimal commas,
no grouping, at most two decimals: 66,67/100 and 80/100. No percent suffix.

Proposed frontend route, supplied by the separate resolver PR:
`{LEARNUP_FRONTEND_BASE_URL}/learner/courses/by-course/{courseId}/results`

The base must be absolute http(s), without user info, query or fragment, and supports
deployment subpaths/trailing slashes. Metadata contains only link (the relative route),
courseId, assessmentId, assignmentId (compatibility alias), submissionId and finalizedAt.
The frontend resolver calls GET /enrollments/me for the signed-in learner and redirects
to /learner/courses/:enrollmentId/results; it handles sign-in, unavailable and missing
enrollment states. Notification does not call Learning.

## Rollout

Order: **PR-1 consumer → PR-3 frontend resolver → PR-2 producer**.
The mixed-channel retry follow-up must also merge before the Assessment producer.

PR-1 retains generic REST notification/email endpoints and changes no Assessment code.
Before PR-2, no producer emits this event, so the new consumer adds no second notice.
PR-2 must remove the finalize REST call in the same change that emits the new event;
keep shared deliverNotice reminder/waiver callers. Drain old producer instances:
their in-flight REST notices have no eventId and cannot be deduplicated by this ledger.
Do not backfill previously notified submissions without reconciliation. This change
does not recover historical notices that were already lost.
