# UC25.3 enrollment benchmarks (D74–D76)

Run from the repository root in Windows PowerShell with Node 22, Docker Desktop,
and migrated/seeded local PostgreSQL. Fixture commands reject NODE_ENV=production.
Both services run through compose using node:22-alpine. k6 runs as grafana/k6 in
learnup_learnup-network and calls http://learning-service:8085; learning calls
http://course-service:8083. Docker-to-Windows-host HTTP measurements are excluded.

The workload sends gateway identity headers directly: **gateway/JWT are excluded**.
Tenant access is fake: TENANT_CLIENT_MODE=fake returns Active with
TENANT_FAKE_TIMEZONE=Asia/Ho_Chi_Minh. Course-service and both databases are real.
Keep one learning instance, default pool 10 per service, course HTTP timeout 3000 ms
and enrollment rate limit 10/minute/user. Do not tune these to pass thresholds.

## Start and verify connectivity

```powershell
docker compose build course-service learning-service
docker compose up -d postgres course-service learning-service
docker run --rm --network learnup_learnup-network --mount "type=bind,source=$PWD/perf/learning,target=/scripts,readonly" grafana/k6 run /scripts/connectivity.js
$env:PERF_DB_PORT='5433'
node perf/learning/fixture.cjs seed
```

Connectivity must reach learning authentication and return 401. The runner reads
the internal key from the learning container without printing it. Fixture SQL uses
the host's published PostgreSQL port; measured HTTP traffic stays inside Docker.
Adjust PERF_DB_PORT to the local database mapping.

## Isolated fixture

Organization: 25030000-0000-4000-8000-000000000001.
Target Course: 25030001-0000-4000-8000-000000000001 (Public/Published).
Title Case values are declared once in fixture.cjs and remain compatible with D71.
There are 5,000 deterministic header identities:
25031000-0000-4000-8000-000000000001 through
25031000-0000-4000-8000-000000005000. Tenant/identity rows are unnecessary for fake
tenant access. Background learners use another prefix. The fixture also creates
100 other courses and 50,000 background enrollments within the perf organization.
Demo IDs and other organizations are excluded from fixture writes.

The target tree has one module, one active lesson and one required Reading material.
One snapshot set means one course snapshot and one material snapshot; sparse
lesson_snapshots correctly contains zero rows for an active lesson.
reset --snapshot deletes target enrollments/snapshots and resets locked_at;
reset preserves snapshots and the lock. Deletions filter organization and exact
fixture course/asset IDs; ownership is checked before writes.

## Workloads

```powershell
./perf/learning/run.ps1 -Label before-a -Mode A -UserOffset 4900
./perf/learning/run.ps1 -Label before-b2 -Mode B -Vus 2 -UserOffset 4700
./perf/learning/run.ps1 -Label before-b200 -Mode B -Vus 200 -UserOffset 4500
./perf/learning/run.ps1 -Label before-c10 -Mode C -ArrivalRate 10
./perf/learning/run.ps1 -Label before-c30 -Mode C -ArrivalRate 30
./perf/learning/run.ps1 -Label before-c60 -Mode C -ArrivalRate 60
./perf/learning/run.ps1 -Label before-c100 -Mode C -ArrivalRate 100
./perf/learning/run.ps1 -Label before-w30 -Mode C -ArrivalRate 30 -Warm
node perf/learning/fixture.cjs explain
node perf/learning/fixture.cjs cleanup
```

A is unchanged: 15 requests over approximately 10 seconds from one learner plus
five isolated learners. Expect six 201, nine ALREADY_ENROLLED 409 and five
RATE_LIMITED 429 with matching Retry-After/body seconds. Burst 2/200 VU makes one
request per learner; record latency without using it as an acceptance criterion.

C uses constant-arrival-rate, one POST per iteration with
scenario.iterationInTest + 1, no sleep and no retry. Each level lasts 45 seconds;
100 VUs are preallocated, capped at 300. Keep evidence of dropped iterations rather
than raising the cap indefinitely. Every cold level resets snapshots and locked_at.
Warm 30 preserves the preceding snapshot/lock while clearing target enrollments.
Offsets keep A/burst identities outside the 4,500 identities used at 100 req/s.

The criterion is the highest cold arrival rate with p95 <500 ms, zero unexpected
errors and zero dropped iterations. Expected A 409/429 responses are business
outcomes. k6 threshold failures preserve evidence and warn; failed SQL invariants
stop the runner. SQL independently requires Enrollment count = observed 201 count,
zero duplicate learner/course pairs, one snapshot set and zero orphans.

## Before/after controls

Use develop 2607f9c for learning throughout and for course before the change;
use fix/course/uc25.3-i1-lock-fast-path for course after the change. Fetch develop
before each phase and stop if it changes; never mix D71 backgrounds. Run the entire
sequence twice with identical machine/Docker settings and workload parameters.
Restart both services between phases to reset process-local state.

The local comparison can pin the same service images/dependencies and mount the
compiled I1 module from each exact source revision into course-service through an
ignored compose override. This isolates the only production-code difference.
Record source revisions, image IDs, module hashes, Node versions, CPU/RAM and Docker
resources beside the results. No pool, timeout or learning code changes are used.

## Evidence and temporary observation

All machine-specific output stays in ignored results/:

- *-summary.json and *-samples.json: p50 (med)/p95/p99, dropped iterations,
  throughput, HTTP failure rate and status distribution.
- *-pg-activity.json: 100 ms samples of sessions, state and wait events. Fixture
  monitor connections are excluded using application_name.
- *-sql.json: target enrollments, duplicates, snapshot rows, orphans and table size.
- *-docker-stats.txt: sampled CPU/memory of learning, course and PostgreSQL.
- *-report.json: combined latency/errors/HTTP distribution and PostgreSQL maxima
  for connections, Lock:tuple sessions and all Lock waits per database.

pg_stat_activity cannot expose the Node pool queue. For exact maximum pending
acquisitions, use a temporary preload observing pg Pool.connect/waitingCount and a
container-loopback endpoint on port 18084, then pass -ObservePools. The runner
resets/reads it using compose exec and records learning queue maxima and course
I1/I2 counts/queue maxima. Keep preloads and compose overrides ignored; remove the
temporary instrumentation after measurement. Use the same preload in both phases.
Without it, pool queue data is unavailable, never assumed zero. PostgreSQL wait
samples provide independent evidence and can miss waits shorter than 100 ms.

fixture.cjs explain checks the existing enrollment lookup at >=50,000 rows; its
INSERT plan runs in a transaction that always rolls back. The new I1 SELECT is
checked separately by the course integration test with 20,000 isolated Course
rows. Report actual scan type and execution time.
