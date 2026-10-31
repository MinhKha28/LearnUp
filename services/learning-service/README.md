# learning-service

NestJS + Prisma 7 service for LearnUP.

Database: `learning_db`
Port: `8085`

The Prisma schema follows `LearnUP_Database_Guide.docx` service ownership and table boundaries.


## L6 outbox relay

`OUTBOX_DRAIN_GAP_MS` defaults to 50 ms between full batches. An explicit environment
value overrides the default; zero disables the pause. Compose exposes the override as
`LEARNING_OUTBOX_DRAIN_GAP_MS`.

Enable with OUTBOX_RELAY_ENABLED=true; default false keeps unrelated tests isolated.
See .env.example for Kafka brokers, topic, replication factor, poll/batch size,
delivery/probe/transaction timeouts, exponential backoff and alert threshold.
The Docker stages use node:22-alpine3.24 (verified built image: Alpine 3.24.3, Node 22.23.4).
The Confluent client is pinned to 1.11.0 and uses native binaries for each platform;
the Docker build excludes host node_modules and generates Prisma inside Linux.

The relay publishes the four existing Enrollment events without modifying their
writers. It has at-least-once delivery; consumer eventId deduplication is required.
A failed preflight broker probe leaves attempts unchanged. Common send failures
increase attempts for every claimed head; record-specific failures are isolated
with concurrent sends. Permanently invalid heads block their aggregate until an
operator repairs the underlying issue. Logs and last_error contain safe codes only.

| Class | Confluent/librdkafka code | Action |
| --- | --- | --- |
| Record | 2 ERR_INVALID_MSG, 4 ERR_INVALID_MSG_SIZE, 10 ERR_MSG_SIZE_TOO_LARGE | Drain batch reports, then concurrent individual retry |
| Serialization | -162 ERR__KEY_SERIALIZATION, -161 ERR__VALUE_SERIALIZATION; local OUTBOX_SERIALIZATION | Concurrent individual retry |
| Connection/timeouts | -195 ERR__TRANSPORT, -193 ERR__RESOLVE, -192 ERR__MSG_TIMED_OUT, -187 ERR__ALL_BROKERS_DOWN, -185 ERR__TIMED_OUT, -166 ERR__TIMED_OUT_QUEUE, 7 ERR_REQUEST_TIMED_OUT | Back off entire batch |
| Broker/security/unknown | All other codes, including leader/ISR/auth failures | Back off entire batch |

Run unit tests with NODE_PATH pointing at this service and npm run test:unit.
Run npm run test:integration for regression. The dedicated relay test additionally
requires OUTBOX_INTEGRATION=true and Kafka; the harness supplies its isolated,
automatically migrated PostgreSQL database.
It creates a unique topic/group, owns fixtures by a random organization id, and
cleans its topic and rows. OUTBOX_KAFKA_CHAOS=true additionally requires
OUTBOX_TEST_KAFKA_CONTAINER explicitly naming a disposable Compose Kafka container;
that test stops/restarts it and checks HTTP database reads while Kafka is down.
Never point chaos tests at a shared broker. Each test run measures publication
p50/p95 and prints one synthetic envelope consumed from Kafka.

## Course completion

The API worker polls durable completion_evaluation_requests. Video's first completed
transition, assignment CONVERT/RESTORE and Optional restore enqueue in their existing
transaction. CONVERT_COMPLETED does not enqueue. Reading, exemption removal and incoming
assessment/course consumers remain pending. Assessment completion HTTP uses only service
authentication and organization scope, never a fabricated Learner principal.

COMPLETION_WORKER_ENABLED defaults true (tests explicitly disable it). Defaults:
COMPLETION_POLL_MS=1000, COMPLETION_BATCH_SIZE=5, COMPLETION_LEASE_MS=30000,
COMPLETION_CONCURRENCY=5,
COMPLETION_TRANSACTION_MS=5000, COMPLETION_BACKOFF_MS=1000,
COMPLETION_BACKOFF_MAX_MS=300000, ASSESSMENT_COMPLETION_TIMEOUT_MS=3000.
The 30-second lease leaves room beyond the 3-second HTTP timeout, 5-second transaction
budget and 1-second scheduling margin. Startup requires lease > HTTP timeout + transaction
budget + 1000 ms even if the worker is disabled. These are operational defaults, not BRs.

Full claim waves drain immediately after setImmediate yields; only partial/empty waves
sleep COMPLETION_POLL_MS. Claims are capped at min(batch size, concurrency), with no
internally waiting leased items. Each wave finishes before the next claim or queue metric
query; worker database operations therefore never exceed concurrency. Backoff eligibility
still controls failed items, so a failure cannot force immediate reassessment in the drain loop.

The existing API/relay pool remains capped at 10 connections (the previous pg-pool default).
The worker owns a separate pool capped at COMPLETION_CONCURRENCY, default 5, reserving the
original API capacity. Five preserves the established evaluation parallelism while removing
the one-second gap. Total learning connection budget is now 15 per API process by default;
replica counts and other services must fit PostgreSQL capacity. This reserves connection
capacity, not a guarantee of API throughput against shared DB CPU/I/O.

perf/learning/course-completion-paired.ps1 runs A-B-A-B-A-B at each VU level, using an
unchanged 52cfbc0 archive and identical fixture IDs per pair. Supply -BaselineRoot and
reuse installed dependencies/generated client; no install or migration is performed.
COMPLETION_PERF_PHASES defaults off; true enables harness-only requested/claim/client/commit
probes with raw traces under ignored results. No production logger/probe is installed.
Compare both coverage and completion Video phases at the same VUs: B is the median of
three baseline p99s; stop if at least two of three branch p99s exceed max(500ms,1.5*B).
Also stop on HTTP errors >1% or incorrect Completed/event counts. Warn when median p99
increases >20%. k6 and service share the same host. Small finite bursts are not steady-state
capacity measurements, and probe overhead is part of the instrumented branch measurement.

ASSESSMENT_COMPLETION_CLIENT_MODE defaults http. Assessment supplies
GET /api/v1/internal/learners/:learnerId/courses/:courseId/completion-snapshot.
Errors retain requests with bounded exponential backoff and no retry cap.
Learning recomputes completion from scores, finalization and peer duty; Waived,
NotApplicable and Satisfied satisfy peer duty. Assessment flag disagreements produce
one COMPLETION_SNAPSHOT_MISMATCH warning per evaluation; the stored and published
snapshot stays unchanged. HTTP failures retain their status in error diagnostics;
INVALID_SNAPSHOT and HTTP 400/401/403/404/422 are marked permanent but still retried.
fake mode is forbidden in production. FakeAssessmentCompletionClient.fixtures is keyed
by organizationId/learnerId/courseId; missing fixtures return eligible=false. Explicit
fixtures support passing/failing scores, unfinalized assignments, pending/missed peer
duty, empty sets, delayed responses/timeouts and malformed responses. Test code installs
fixtures through dependency injection; no public fixture-control endpoint exists.

Claims increment generation and lease next_attempt_at using SKIP LOCKED. New triggers
increment generation, reset eligibility time and preserve attempts. Delete/retry requires
the claimed generation. A stale assessment result is discarded before any business write.
Expired claims are reclaimed, including after process death. Completion, immutable snapshot,
outbox and conditional request deletion share one transaction. Queue logs report pending,
oldest_seconds, leaseExpired and generationDiscarded; counters are process-local totals.
Logs contain fixed diagnostic codes and aggregate metrics, not scores or personal data.

The queue uses unconstrained text for source/error codes with CHECK allowlists instead of
arbitrary varchar limits; attempts and generation use nonnegative bigint for long-lived
retry/version counts. No retry maximum deletes work. The due index supports ordered bounded
claims; material indexes require EXPLAIN evidence before addition. Legacy Completed fixtures
in seed-enrollments.ts intentionally retain NULL completion_snapshot; they are not rewritten.


## Isolated Learning integration tests

Use Node 22.23 or later and PostgreSQL 16. From `services/learning-service` in
PowerShell, set `$env:NODE_PATH=(Get-Location).Path`, set `DATABASE_URL` to a
non-production PostgreSQL server, then run `npm run test:integration`.
The PostgreSQL user needs CREATE/DROP DATABASE privileges and access to `postgres`.
For CI, an empty `postgres:16-alpine` service container is sufficient. No running
Course, Tenant, Assessment or Kafka service, cross-service database, or manual
seed command is required. Do not run individual integration files directly.

The parent harness connects to the server's `postgres` administration database,
creates one `learning_it_<random UUID>` database, applies every Learning Prisma
migration SQL file in sorted order (the achievement-reporting harness pattern),
and inserts only the Learning platform setting fixture. Both Prisma and raw pg
clients use that same generated URL. The parent drops the generated database in
`finally`, including after test failure or timeout; it never migrates, seeds, or
cleans an existing `learning_db`. A configured `course_db` URL is rejected before
connecting. The tests never open a Course database connection.

A local Node HTTP server starts before importing the app and closes after the
suites. It serves the four Learning Course endpoints from explicit typed answers:
lock, tree, batch and lesson. Each test resets those answers and the request log;
fixtures may override responses explicitly. The stub contains no Course eligibility,
locking or lifecycle business rules. Synthetic keys are confined to the test child.
`TENANT_CLIENT_MODE=fake` and assessment fakes are set by the harness; both workers
are disabled initially. The existing outage test explicitly enables them against
an unreachable broker. Kafka integration/chaos opt-ins remain off unless explicitly
set with `OUTBOX_INTEGRATION=true` / `OUTBOX_KAFKA_CHAOS=true`.

Harness HTTP uses **3000 ms from the learning-service environment in
`docker-compose.yml`**. The runner reads that deployed value; only if Compose does
not set it does it read `.env.example`. No Course HTTP timeout code default is
introduced. Integration per-test, suite, named barrier, pg connection/statement,
and teardown budgets are defined in `test/integration/deadlines.ts`. The CLI suite
limit and parent process cap also cover startup/imports and leaked handles. The
single test process uses Node's no-isolation mode so killing it cannot leave a
separate test-file process alive. Prisma-created pg pools receive the same bounded
connection/statement settings inside the test harness only. Teardown attempts all
handles even when fixture reset or another close fails. Native Kafka admin/producer
connect attempts are bounded in the harness by the configured relay probe budget;
a failed attempt disconnects its native handle, and final teardown retries all
tracked native handles. This preserves real unreachable-broker checks without
letting connection retries hold relay shutdown open. Production code is unchanged.

For focused debugging, `LEARNING_IT_SUITE=course-completion` (or another filename
stem imported by index.ts) runs only that file. `LEARNING_IT_TEST_NAME` optionally
filters its tests by name. Leave both unset for a full integration run.

The entry point imports 17 integration test files (15 Node describe suites plus
standalone tests), rather than the 18 suites reported by IT1.

Three consecutive full runs against an empty `postgres:16-alpine` container on
`127.0.0.1:5434` passed 229 tests each (234 discovered; 5 Kafka opt-ins skipped).
End-to-end times were 36.145 s, 34.968 s and 29.677 s; Node test durations were
33.569 s, 32.539 s and 27.474 s. The slowest individual test was the 50,000-row
withdrawal EXPLAIN test at 4618.4548 ms. Final per-test budget is **19000 ms**
(4 × that maximum, rounded up to a whole second); the CLI and parent suite cap
is **109000 ms** (3 × the slowest end-to-end run, rounded up). These values were
set after the three measurements; focused suites were rerun with the final
budgets. Named barriers use 5000 ms; pg connection/statement and individual
teardown operations use 10000 ms. Kafka opt-in tests retain their explicit
longer per-test budgets but are still subject to the suite cap.

### Course guarantees and ownership

Learning relies on these guarantees, which belong to Course. These references were
read, not executed, on develop `8840e76`:

| Guarantee | Course test evidence |
| --- | --- |
| Concurrent/repeated lock calls retain one lock timestamp | `services/course-service/test/internal-courses.lock.db-test.ts:67` (20 concurrent calls, one UPDATE); `:84` (already locked call is SELECT only) |
| Draft is unavailable to assignment | `services/course-service/src/modules/internal-courses/internal-courses.service.spec.ts:56` (locked Draft/Public, selfEnroll=false returns 409); first-lock Draft is NOT COVERED directly |
| Rejected calls do not change `updated_at` or lock timestamps | NOT COVERED directly; mocked eligibility tests assert no first-lock transaction, not persisted timestamps |

The former Course-row assertions now check Learning's mapping of configured
409/404 responses, absence of Learning writes, request method/path/selfEnroll,
repeated parsing of the same configured timestamp, and absence of Course calls
during withdrawal. They do not establish Course's write behavior. All other
Learning assertions retain their intent.

### Optional read-only live Course contract check

`npm run test:contract:course` is separate from integration and requires
`COURSE_CONTRACT_CHECK=true`. Set the real `COURSE_SERVICE_URL`,
`COURSE_SERVICE_TIMEOUT_MS`, `INTERNAL_SERVICE_KEY`, and these explicit readable
fixtures: `COURSE_CONTRACT_COURSE_ID`, `COURSE_CONTRACT_LESSON_ID`,
`COURSE_CONTRACT_USER_ID`, `COURSE_CONTRACT_ORGANIZATION_ID`, and
`COURSE_CONTRACT_USER_ROLE`. Keep `NODE_PATH` set to the service directory.

It performs only GET tree, POST batch (a read), and GET lesson; it never calls
lock or opens a database. It validates formats using Learning's contract types
and tree parser, without asserting fixed seed names, counts or timestamps.
A failed check prints a request to raise a `[learning → course]` issue.
This read-only check cannot verify write behavior such as lock idempotence,
Draft-lock rejection or unchanged database timestamps.
