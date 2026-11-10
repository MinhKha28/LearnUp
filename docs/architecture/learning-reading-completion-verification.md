# L20 — UC27.3 Reading completion verification

Baseline: `2577007` (origin/develop, PR #144). Implementation branch:
`feat/learning/uc27.3-reading-completion`. Verification date: 2026-10-24.

## Approved behavior and implementation

- **D1 / BR-184:** Completed Enrollment returns HTTP 200 without writing progress,
  activity or an evaluation request. An unread material returns `completedAt: null`
  and `alreadyCompleted: false`. Existing completion remains immutable.
- **D2:** Exempted accepts completion and enqueues evaluation, preserving Exempted
  until the existing Course evaluator determines eligibility.
- **D3 / BR-183:** Learner self-marks Reading. Opening a file is not a prerequisite;
  the server still checks trusted Learner/Organization ownership, Course version,
  material type, stored Enrollment status and snapshot disabled flags.
- **D4:** A failed or uncertain network operation displays an unconfirmed outcome
  and permits an explicit retry. There is no persistent Reading submission queue.
- **D5:** Video returns `409 MATERIAL_NOT_READING`; disabled content and Halted
  return `403 CONTENT_UNAVAILABLE`; Withdrawn/foreign owner/Organization return
  `404 ENROLLMENT_NOT_FOUND`; missing/wrong-version material returns
  `404 MATERIAL_NOT_FOUND`. Reading access dependency failure/timeout and pending
  C10 integration return `503 SERVICE_UNAVAILABLE`. Unknown stored status fails
  closed with HTTP 500 and fixed `INVALID_ENROLLMENT_STATUS` diagnostics.
- **D6:** `POST /api/v1/enrollments/:enrollmentId/materials/:materialId/complete-reading`
  accepts no business body (`{}` is accepted; unknown keys return
  `422 VALIDATION_ERROR`). Its existing success envelope contains `materialId`,
  `completedAt`, `alreadyCompleted`, `lessonCompleted`, `enrollmentStatus` and
  `completionEvaluationPending`. Invalid JSON/scalar JSON rejected by the existing
  HTTP parser retains its parser-level HTTP 400 response.
- **BR-185/186, BR-178:** Lesson completion adapts active snapshots into the existing
  `buildCurriculum` calculation. Required materials determine a required Lesson;
  otherwise all active materials must complete. An empty visible Lesson is neutral
  (`null`), never completed. There is no I2 call during the completion transaction.
- **D7:** `GET .../reading-access` has `READING_ACCESS_MODE=course` by default and
  returns 503 until C10 provides the content-access contract. Development/test can
  explicitly set `READING_ACCESS_MODE=fixture` and `READING_FIXTURE_URL` to an HTTP(S)
  document URL. Fixture mode is rejected in production. Responses and UI explicitly
  identify a fixture; it is not a signed URL. Fixture access still checks I2.
- **D8 / BR-140:** Video and Reading reuse `activateEnrollmentSql`. For
  NotStarted/InProgress/Exempted it keeps the earliest activity using
  `LEAST(COALESCE(first_activity_at, now), now)`; only NotStarted changes status.
  Existing Video progress behavior is regression-tested.

## Transaction, idempotency and schema

The existing Enrollment access query locks the owned Enrollment row before the
Reading write. `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE completed_at IS NULL
RETURNING completed_at` identifies exactly the first completion transition. Only a
returned row invokes the shared activation helper and
`requestCompletion(..., 'READING_COMPLETED')`, in that same transaction. Duplicates
read the old result and preserve progress/activity timestamps and request generation.
Enqueue failure rolls back both completion and activation.

Reading stores a server timestamp and `watched_ranges = NULL`. Existing
`ck_progress_not_empty` permits this; the progress schema and Prisma model do not
change. New migration `20261024120000_reading_completion` only extends the existing
source CHECK with `READING_COMPLETED`. Previous migrations are unchanged. The new
migration was applied successfully to the local verification database with explicit
approval; no dependency installation, Docker image build or Compose command was used.

The evaluator, durable request generation/lease mechanism, Assessment snapshot and
Completed/outbox transaction remain those of PR #144. Reading does not implement a
second Course evaluator (BR-165/260/261). A pending response is not a promise that
the asynchronous evaluator has already completed the Course. Overdue is computed
using the existing display-status SQL and does not block learning.

## Frontend and contract

The existing Lesson resource route selects Video or Reading from Lesson metadata.
Reading exposes a one-way completion button, guards simultaneous clicks, uses the
existing Axios/auth-refresh path and binds replay to the original account and
Organization. A Completed Enrollment cannot be marked further from the screen.

Lesson, resource, UC27 curriculum and My Courses refetch on `learning-progress`,
window focus and visible-tab events. A pending completion schedules at most three
additional notifications, at 2/4/6 seconds, which survive route changes without
persisting a progress payload. Enrollment refresh remains bounded. Another tab's
change is reconciled when this tab becomes focused/visible.

The public Reading routes, trusted service headers, response fields, fixture mode
and error outcomes are documented in
[`contracts/openapi/learning-service.yaml`](../../contracts/openapi/learning-service.yaml).
YAML parsing and all 39 local schema/parameter/response references were checked.

## Verification

| Check | Actual result |
| --- | --- |
| Learning complete unit suite | 274 passed, 0 failed |
| Learning complete PostgreSQL integration suite | 229 passed, 0 failed, 5 opt-in Kafka relay tests skipped (234 total) |
| Final focused Reading PostgreSQL suite | 23 passed, including unchanged retry timestamps |
| Completion + Reading while Kafka and course-service containers were stopped | 55 passed, 0 failed, no skips; only PostgreSQL running |
| Frontend full suite, `LEARNUP_RECOVERY_BROWSER_TESTS=1` | 417 passed across 29 files, no skips |
| Final Reading Chromium UI check after status-label/error presentation changes | 3 passed |
| Learning build and changed backend source lint | Passed |
| Frontend build, final TypeScript check and changed frontend source lint | Passed; existing Vite bundle-size advisory remains |
| OpenAPI YAML and local references | Passed |

The PostgreSQL tests cover first completion, simultaneous duplicate requests,
retry immutability, existing NULL completion, transactional enqueue rollback,
NotStarted/InProgress/Overdue/Exempted/Completed/Halted/Withdrawn, wrong
Learner/Organization/version, Video rejection, disabled material/Lesson/Course,
BR-185/186 required/optional/disabled/empty Lesson cases, fixture/course modes,
I2 disabled flags, shared Video activity behavior and the existing Course evaluator
emitting exactly one completion event from Reading.

Chromium tests exercise the real Reading route/components and Axios against an
isolated HTTP Gateway stub: pending double-click suppression, no unmark action,
bounded 2-second refreshes, network uncertainty with explicit retry, and focus/
visibility reconciliation. Axios HTTP tests cover token refresh and account change
during replay. Network/browser tests initially failed inside the sandbox and passed
outside it; assertions were not weakened. Five pre-existing real Kafka relay tests
remain opt-in; these results do not claim a successful live Kafka delivery test.

## k6 methodology and results

Harness: `perf/learning/reading-completion-paired.ps1`,
`reading-completion-run.cjs` and `reading-completion.js`.

The final measurement runs after unit/integration/browser tests have finished.
Baseline source is an archive of `2577007`; installed dependencies and generated
Prisma client are reused without installation or generation. Both sides use the
same PostgreSQL, pool configuration and HTTP topology. Course/Kafka are not needed
for the measured writes. The worker and relay are disabled so durable enqueue
counts/generation can be observed before consumption; evaluator/outbox correctness
is verified separately by integration tests.

Only 1, 100 and 200 VUs are allowed. Each side performs five fresh Enrollment
completions per VU, each followed by an idempotent duplicate, with an HTTP/DB warm-up
outside the measurement. At each level, Video runs A1–B1–A2–B2–A3–B3. Reading runs
three separate branch-only rounds: baseline has no Reading endpoint, so no 404 is
used as a performance baseline.

For each Video phase and VU level, B is the median p99 of three baseline rounds.
Stop when at least two branch rounds exceed `max(500 ms, 1.5 * B)`, or immediately
for error rate >1%, invalid functional checks, wrong completion/activation/request
counts or duplicate generation. Reading reports latency independently and stops
on errors or incorrect effects. No 1000-VU workload is run. This is a local burst
comparison, not a production steady-state SLA; the 1-VU phase has only five samples
per round.

Final controlled run: **27 rounds, 27,090 measured HTTP requests, 13,545 distinct
completions/activations/evaluation requests, zero duplicate generations, zero HTTP
errors, and 100% functional checks**. Each of Video baseline, Video branch and
Reading branch accounts for 4,515 distinct completions and 9,030 HTTP requests.
All levels finished without meeting a stop condition. Floating-point thresholds
were recalculated from the saved raw rounds and checked without rounding before
producing the tables below; display values are rounded to two decimals.

Video regression, median of three p99 measurements, milliseconds:

| VUs | Phase | Baseline B | Branch | Stop threshold | Branch breaches |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | First completion | 41.92 | 45.27 | 500.00 | 0/3 |
| 1 | Duplicate | 17.40 | 16.51 | 500.00 | 0/3 |
| 100 | First completion | 616.12 | 671.34 | 924.18 | 0/3 |
| 100 | Duplicate | 494.87 | 548.52 | 742.31 | 0/3 |
| 200 | First completion | 1290.77 | 1326.02 | 1936.15 | 0/3 |
| 200 | Duplicate | 1197.89 | 1209.74 | 1796.83 | 0/3 |

Reading branch-only p99, milliseconds:

| VUs | Phase | Round 1 | Round 2 | Round 3 | Median |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | First completion | 36.46 | 42.35 | 48.32 | 42.35 |
| 1 | Duplicate | 13.83 | 13.93 | 14.72 | 13.93 |
| 100 | First completion | 657.37 | 625.02 | 715.93 | 657.37 |
| 100 | Duplicate | 558.37 | 648.16 | 691.33 | 648.16 |
| 200 | First completion | 1003.73 | 1020.45 | 1051.52 | 1020.45 |
| 200 | Duplicate | 895.71 | 893.14 | 945.71 | 895.71 |

Latency exceeds 500 ms under the larger local bursts; this result does not assert
an absolute 500-ms SLA. Video is assessed against the approved relative baseline
threshold; Reading is reported independently. Preliminary exploratory rounds were
excluded because browser tests overlapped them. The final table uses only rounds
run after those tests ended. Course-service was restarted after the outage/perf
checks; Kafka remained in its original stopped state.

## Limits, ownership and follow-up

- **C10:** Production file access remains deliberately unavailable until the
  course-service access endpoint exists. No course-service code was changed.
- **L23 / BR-300/306/307:** POST trusts the disabled flags already in local
  snapshots, as Video does. An upstream change not yet reflected in those snapshots
  can temporarily remain writable. Reading does not add an I2 call to close this
  distributed consistency gap. GET fixture access additionally checks I2.
- **L21:** Comments mark the future sequential-access policy insertion points
  before issuing content access and before the completion transition. No sequential
  learning rules are implemented.
- No second learning-data definition, Lesson completion rule or Course evaluator
  was introduced (BR-145/116, BR-185/186, BR-165/260/261).
- No PR or merge is part of this task. Generated build output, local logs, benchmark
  fixture IDs, credentials and temporary baseline archives are excluded from Git.

There are no intended deviations from the approved D1–D8 behavior. Parser-level
invalid JSON retains existing handling; known C10/L23/L21 limits are explicit above.

## Changed files

- [contracts/openapi/learning-service.yaml](../../contracts/openapi/learning-service.yaml)
- [docs/architecture/learning-reading-completion-verification.md](../../docs/architecture/learning-reading-completion-verification.md)
- [frontend/dev/reading.completion.browser.test.ts](../../frontend/dev/reading.completion.browser.test.ts)
- [frontend/src/hooks/use.learning.refresh.ts](../../frontend/src/hooks/use.learning.refresh.ts)
- [frontend/src/pages/learner/course.curriculum.tsx](../../frontend/src/pages/learner/course.curriculum.tsx)
- [frontend/src/pages/learner/lesson.detail.tsx](../../frontend/src/pages/learner/lesson.detail.tsx)
- [frontend/src/pages/learner/lesson.resource.tsx](../../frontend/src/pages/learner/lesson.resource.tsx)
- [frontend/src/pages/learner/my.courses.tsx](../../frontend/src/pages/learner/my.courses.tsx)
- [frontend/src/pages/learner/reading.resource.scss](../../frontend/src/pages/learner/reading.resource.scss)
- [frontend/src/pages/learner/reading.resource.tsx](../../frontend/src/pages/learner/reading.resource.tsx)
- [frontend/src/services/learning.progress.test.ts](../../frontend/src/services/learning.progress.test.ts)
- [frontend/src/services/learning.service.ts](../../frontend/src/services/learning.service.ts)
- [frontend/src/types/learning.types.ts](../../frontend/src/types/learning.types.ts)
- [perf/learning/reading-completion-paired.ps1](../../perf/learning/reading-completion-paired.ps1)
- [perf/learning/reading-completion-run.cjs](../../perf/learning/reading-completion-run.cjs)
- [perf/learning/reading-completion.js](../../perf/learning/reading-completion.js)
- [services/learning-service/.env.example](../../services/learning-service/.env.example)
- [services/learning-service/prisma/migrations/20261024120000_reading_completion/migration.sql](../../services/learning-service/prisma/migrations/20261024120000_reading_completion/migration.sql)
- [services/learning-service/src/modules/course-completion/completion-request.ts](../../services/learning-service/src/modules/course-completion/completion-request.ts)
- [services/learning-service/src/modules/material-progress/complete-reading.pipe.ts](../../services/learning-service/src/modules/material-progress/complete-reading.pipe.ts)
- [services/learning-service/src/modules/material-progress/material-progress.controller.ts](../../services/learning-service/src/modules/material-progress/material-progress.controller.ts)
- [services/learning-service/src/modules/material-progress/material-progress.module.ts](../../services/learning-service/src/modules/material-progress/material-progress.module.ts)
- [services/learning-service/src/modules/material-progress/material-progress.repository.ts](../../services/learning-service/src/modules/material-progress/material-progress.repository.ts)
- [services/learning-service/src/modules/material-progress/material-progress.service.ts](../../services/learning-service/src/modules/material-progress/material-progress.service.ts)
- [services/learning-service/src/modules/material-progress/reading-access.config.ts](../../services/learning-service/src/modules/material-progress/reading-access.config.ts)
- [services/learning-service/test/integration/course-completion.integration-test.ts](../../services/learning-service/test/integration/course-completion.integration-test.ts)
- [services/learning-service/test/integration/index.ts](../../services/learning-service/test/integration/index.ts)
- [services/learning-service/test/integration/reading-completion.integration-test.ts](../../services/learning-service/test/integration/reading-completion.integration-test.ts)
- [services/learning-service/test/unit/index.ts](../../services/learning-service/test/unit/index.ts)
- [services/learning-service/test/unit/reading-completion.unit-test.ts](../../services/learning-service/test/unit/reading-completion.unit-test.ts)
- [services/learning-service/test/unit/video-resume.unit-test.ts](../../services/learning-service/test/unit/video-resume.unit-test.ts)
