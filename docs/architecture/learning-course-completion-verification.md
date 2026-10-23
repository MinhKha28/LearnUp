# Learning Course Completion Verification

Baseline: origin/develop 52cfbc0 (includes L6 3c7649b and L17 ecab6b3).
Branch: feat/learning/course-completion-evaluation. Verification date: 2026-10-24,
Asia/Ho_Chi_Minh. PostgreSQL 16, existing disposable L6 course/Kafka environment.

## Implemented behavior

Video's first material completion, assignment CONVERT/RESTORE and Optional restore
enqueue in their existing transaction. Already Completed conversions keep the original
snapshot/completedAt and emit no second completion. EnrollmentAssigned payload is preserved.

The API worker defaults enabled, polling every second with batches of five. Claims use
SKIP LOCKED, increment generation and set a configurable 30-second lease. New triggers
increment generation, preserve attempts and bypass backoff. Conditional deletion/retry
cannot erase newer signals. A worker abandoned after claim is recovered after lease expiry.
The lease must exceed HTTP timeout (default 3s), transaction budget (default 5s) plus 1s.
Startup validates this even when the worker is disabled; production forbids fake clients.

Before HTTP, the worker checks eligible stored status and local required materials with
NOT EXISTS. HTTP runs outside database transactions and uses service authentication,
organization scope and explicit learner/course IDs. Responses are strictly validated,
including nested fields, decimal strings, identity, counts and eligibility consistency.
Unspecified fake fixtures return ineligible; test fixtures use all three identity keys.

The completion transaction locks Enrollment then request, checks generation again,
rechecks status/materials/Course, rejects an empty combined required set, closes Exempted,
and recomputes the deadline from base + extension + union of closed pauses. It atomically
writes Completed, completed_at, completed_late, immutable completion_snapshot, outbox
EnrollmentCompleted, and conditional request deletion. Optional stores NULL completed_late
but emits completedLate=false and dueAt=null. Snapshot is never rewritten after Completed.

Queue logs expose pending count, oldest age, lease expirations and discarded generations.
Counters are process-local; only fixed error codes and aggregate metrics are logged.
No arbitrary source/error text, scores or learner identifiers appear in worker logs.

## Verification commands and results

From services/learning-service, with NODE_PATH set to the service directory:

- npm run test:unit: 268 pass, 0 fail, 0 skip.
- npm run test:integration with OUTBOX_INTEGRATION=true and OUTBOX_KAFKA_CHAOS=true:
  211 pass, 0 fail, 0 skip. Chaos explicitly targeted disposable learnup-l6-kafka.
- npm run build: passed.
- npx --no-install prisma validate: passed; client generation passed.
- prisma migrate deploy: migration 20261024000000_course_completion applied to test learning_db.

Tests cover state eligibility, Quiz passing/failing, Assignment unfinalized and peer
Pending/Missed/Satisfied, required/optional/disabled materials and disabled Lessons,
Course Disabled, empty sets, Required deadlines and overlapping Exempted intervals,
Optional behavior, conversion/restore, immutable snapshots, generation races, disjoint
claimers, abandoned leases, retry recovery and outbox failure rollback on PostgreSQL.
An API test starts with an unreachable broker, retains failed assessment work, serves
an HTTP database read, and completes once the assessment fixture recovers. Existing
L6 chaos tests verify broker stop/restart and ordered recovery with a real consumer.

The first sandbox-only unit attempt failed localhost HTTP fixture access; rerunning
with approved network access passed. No assertions were weakened for that failure.
Integration uses real PostgreSQL/course/Kafka but fake Tenant and completion responses;
it does not validate a deployed assessment completion endpoint or Certificate issuance.

## Performance measurements

Run perf/learning/course-completion-run.ps1 from repository root. k6 runs in Docker,
API in a local ts-node process; PostgreSQL/Kafka/course containers and k6 share the
same host. Defaults: worker batch 5, poll 1s, lease 30s. Each VU has a distinct fixture
Enrollment and submits one incomplete Video coverage report then one completion report.
These are finite bursts, not steady-state capacity tests. Small VU percentile samples
contain only one/two requests per phase and must not be interpreted as robust distributions.

Stop rule fixed before the runs: HTTP errors >1%, mismatched completed/event counts,
or trigger p99 exceeding both 500ms and three times the preceding run. The final run
waits for Kafka publication before reading outbox lag. Raw JSON summaries and EXPLAIN
plans are emitted under perf/learning/results (ignored artifacts, synthetic fixtures).

| VUs/run | Coverage p50/p95/p99 ms | Trigger p50/p95/p99 ms | Completion latency p50/p95 ms | Drain rate /s | Outbox p95 ms |
|---|---|---|---|---|---|
| 1/1 | 49.60/49.60/49.60 | 19.45/19.45/19.45 | 668/668 | 0.71 | 187.12 |
| 1/2 | 21.06/21.06/21.06 | 18.43/18.43/18.43 | 327/327 | 1.09 | 221.38 |
| 1/3 | 18.30/18.30/18.30 | 16.99/16.99/16.99 | 412/412 | 0.88 | 266.54 |
| 2/1 | 15.62/15.98/16.02 | 17.99/18.12/18.13 | 297/297 | 1.88 | 362.64 |
| 2/2 | 15.77/15.99/16.01 | 18.61/18.64/18.64 | 217/217 | 1.90 | 454.00 |
| 2/3 | 29.16/29.23/29.24 | 35.50/35.63/35.64 | 86/86 | 2.01 | 534.64 |
| 100/1 | 402.55/620.16/628.66 | 509.96/551.01/562.58 | 10161.5/18883.25 | 4.57 | 1230.75 |

Every run had 0% HTTP errors, completed count = event count = eligible fixture count,
and zero unpublished fixture events at collection. At 100 VUs, counts were 100/100.
The drain rate includes request launch, queue draining and publication observation;
it is an end-to-end observed rate, not isolated worker CPU throughput. Polling five
items per second makes queue latency increase under a burst; no tuning is inferred.

The 100-VU first run exceeded the p99 stop rule. Remaining two 100-VU repetitions and
200/1000/2000 VUs were deliberately not run. This stopping point is not a capacity limit.
Maximum sampled PostgreSQL lock waiters was zero at 100ms sampling; this does not prove
zero short lock waits or measure per-lock wait duration. API RSS was 388.10 MiB at 100 VUs;
API CPU accumulated 2.547s user + 0.750s system over that burst/drain. Low-load RSS was
420.20–425.62 MiB (ts-node process). Container-wide CPU/RAM and isolated lock-wait duration
were not collected by this harness; these remain measurement limitations.

## EXPLAIN and indexes

Run the same PowerShell harness with -Explain. It creates disposable fixture sets in
a transaction, runs EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON), tests a candidate partial
material index, and rolls back the fixtures/index. No material index was deployed.

| Fixture rows | Material before/after candidate ms | Claim without/with due index ms |
|---|---|---|
| 1 | 0.108 / 0.050 | 0.236 / 0.229 |
| 2000 | 0.450 / 0.409 | 1.339 / 1.841 |

The material candidate indexes organization/course/material, includes Lesson ID and
filters required active materials. An earlier larger-fixture run measured 0.471/0.526ms;
the small absolute differences and inconsistent direction do not justify another index.
Queue comparison drops/recreates the due index inside the rolled-back test transaction.
The due index supports ordered bounded claims; this fixture does not demonstrate a
latency improvement. No further queue index is proposed.
No partial outbox uniqueness index was added; row locking and terminal status are the
business duplicate protection, with existing at-least-once consumer deduplication.

## Remaining boundaries

- Cross-service snapshot timing remains non-atomic: assessment can change after REST.
  The supplied revision is retained but no distributed locking protocol is invented.
- Reading UC27.3, exemption removal UC24.6, and incoming assessment/course consumers
  are intentionally absent. Requests removed as ineligible need a later real trigger.
- Assessment has no completion-snapshot endpoint yet. HTTP failures retain/back off
  requests; fake mode is for tests/development only.
- Achievement-reporting is not implemented here. One logical completion event does
  not prove one real Certificate without the receiving service's idempotency behavior.
- Existing seed-enrollments.ts Completed fixture has no historical snapshot; it stays
  NULL. Production legacy data was not queried or backfilled.
