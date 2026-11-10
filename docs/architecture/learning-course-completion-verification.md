# Learning Course Completion Verification

Baseline source: 52cfbc0; branch: feat/learning/course-completion-evaluation.
Date: 2026-10-24 (Asia/Ho_Chi_Minh). PostgreSQL 16, existing disposable L6 Kafka/course
environment; Tenant and assessment completion responses are fake.

## Worker and pool budget

Video first completion, assignment CONVERT/RESTORE and Optional restore enqueue in their
existing transaction. CONVERT_COMPLETED emits no new completion. SKIP LOCKED claims use
generation and a 30-second lease; signals bypass backoff without resetting attempts.
Conditional retry/deletion preserves newer signals. REST remains outside transactions.
Completion, immutable snapshot, Exempted closure, effective deadline and outbox are atomic.
An empty combined required set cannot complete. Optional emits dueAt=null and completedLate=false.

Defaults: batch=5, concurrency=5, poll=1000ms. Full runnable waves continue after setImmediate;
partial/empty waves return to the poll timer. Each claim is capped at min(batch,concurrency),
after the preceding wave finishes. No leased work waits internally. Errors retain capped
exponential backoff: the immediate drain does not bypass next_attempt_at eligibility.

Previously API/worker shared pg-pool's default maximum of 10 connections. API/relay now
explicitly retain 10; worker has a separate pool capped at COMPLETION_CONCURRENCY (default 5).
Claim, evaluation and queue metric phases do not overlap. Default learning connection
budget is 15 per process, preserving the original API connection allowance. Five preserves
prior parallelism; the change removes idle gaps rather than increasing evaluation concurrency.
Test PostgreSQL max_connections=100. Replicas and other services must fit that total;
separate pools reserve connection capacity, not DB CPU/I/O or guaranteed API throughput.

## Verification

Commands from services/learning-service with NODE_PATH set to that directory:

- npm run test:unit: 271 pass, 0 fail, 0 skip.
- npm run test:integration with OUTBOX_INTEGRATION=true and OUTBOX_KAFKA_CHAOS=true:
  211 pass, 0 fail, 0 skip. Chaos explicitly targets disposable learnup-l6-kafka.
- npm run build: passed.
- git diff --check: passed.

New tests cover full-wave draining without poll sleeps, setImmediate yielding, claims capped
when concurrency < batch, and persistent assessment errors with bounded calls over 130ms
(50ms synthetic backoff). Existing integration covers conditions, deadline/Exempted unions,
generation races, abandoned leases, concurrent Video completion, outbox rollback, immutable
snapshots, convert/restore and outage recovery. No install or migration was required.

## Paired measurement procedure

perf/learning/course-completion-paired.ps1 accepts -BaselineRoot pointing to an unchanged
git archive of learning-service at 52cfbc0. Installed dependencies/generated client and
migrated test DB are shared; baseline source does not run a completion worker. Each pair
recreates identical fixture IDs. Each VU owns an Enrollment with one required 100-second
Video, threshold 80%, and reports [0,10] coverage followed by [0,80] completion once.
API restarts per side/run. Order is A-B-A-B-A-B at each level: 1/2/100/200/1000/2000 VUs.

k6 runs in Docker; API uses local ts-node. k6/API/PostgreSQL/Kafka/course share one host.
These are finite bursts, not steady-state capacity measurements. Low-VU tails contain
one/two samples per phase. Cold process/request effects and host noise remain.

COMPLETION_PERF_PHASES defaults off. True installs harness-only probes for requested_at,
DB claim time, assessment duration, transaction/pool time and commit return, wrapping the
worker's dedicated Prisma client. Production imports none of this instrumentation and has
no phase measurement logger. Fake fixtures set no delayMs: zero deliberate delay, not a REST
network measurement. Raw traces and summaries are under ignored perf/learning/results.

At the same VUs and phase, B=median p99 of three baseline runs. Stop when >=2/3 branch p99s
exceed max(500ms,1.5*B), any run has HTTP errors >1%, or branch completion/event counts mismatch.
Warn when median p99 increases >20%. Thresholds use double precision. Goals at 100 VUs:
requested-to-commit p95 <=5s; completion request median p99 increase <=20%. No further tuning
is performed after a failed goal or stop. Report helper recomputes precise thresholds.

## Current results

Percentiles below are medians of three per-run percentiles, not pooled samples. Units: ms.
All completed paired levels had 0% HTTP errors, checks 100% and matching branch counts.

| VUs | Phase | Baseline p50/p95/p99 | Branch p50/p95/p99 | Median p99 change |
|---|---|---|---|---|
| 1 | Coverage | 51.73/51.73/51.73 | 54.03/54.03/54.03 | +4.44% |
| 1 | Completion | 17.60/17.60/17.60 | 19.40/19.40/19.40 | +10.20% |
| 2 | Coverage | 57.89/61.86/62.17 | 58.13/62.82/63.28 | +1.79% |
| 2 | Completion | 17.19/18.27/18.36 | 17.98/18.62/18.68 | +1.74% |
| 100 | Coverage | 405.31/616.98/624.36 | 403.22/580.16/584.38 | -6.40% |
| 100 | Completion | 444.21/488.97/506.69 | 448.64/488.21/493.88 | -2.53% |
| 200 | Coverage | 714.73/1043.60/1080.69 | 784.22/1136.23/1165.05 | +7.81% |
| 200 | Completion | 838.64/874.34/904.26 | 929.14/1003.33/1017.75 | +12.55% |

| VUs | Requested-to-commit p95, runs 1/2/3 | Completed/events each run |
|---|---|---|
| 1 | 728/706/711 | 1/1 |
| 2 | 731/719.70/725.85 | 2/2 |
| 100 | 421.15/1190.15/1103.05 | 100/100 |
| 200 | 908/1055/904.10 | 200/200 |

Both 100-VU goals PASS: worst run completion p95=1.19015s; completion request median p99
change=-2.53%. No completed level triggers the p99 stop or >20% regression warning.

100-VU marginal phase p95s are not additive:

| Run | Queue | Fake assessment | Transaction including pool/commit |
|---|---|---|---|
| 1 | 393.05 | 0.058 | 53.08 |
| 2 | 1172.10 | 0.032 | 20.77 |
| 3 | 1085.05 | 0.040 | 18.70 |

STOP at baseline 1000 VUs, run 1: 892/2000 failed requests (44.6%). Log reports Prisma
P2028, unable to start a transaction in the given time. This is baseline transaction
acquisition failure under burst load, not evidence of completion-worker failure. Branch
1000, remaining 1000 repetitions and 2000 were not started. No tuning followed the stop;
1000 VUs is not declared a capacity limit.

## Short history and boundaries

The old worker slept one second after every batch, even when full. A 100-request burst
drained at about 4.8/s, with completion p95 about 18.9s. Diagnosis found queue waiting
dominated; fake assessment p95 <0.1ms and transactions took tens of ms. Its previous stop
rule compared 100 VUs against 2 VUs and is superseded by the paired rule above.

Earlier EXPLAIN experiments used 1/2000-row fixtures and rolled back all fixture/index DDL.
The candidate material index showed no consistent benefit; none was added. This change
adds no schema or outbox uniqueness index. Legacy Completed seed rows retain NULL snapshots.

Assessment completion REST, Reading, exemption removal and incoming assessment/course
consumers remain pending. Fake results do not validate real assessment behavior or latency.
Cross-service snapshot timing remains non-atomic. Certificate issuance/idempotency belongs
to the receiving service and is outside this work.
