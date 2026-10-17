# UC25.3 enrollment rate limit and hot Course

Run from the repository root with Windows PowerShell, Node 22, Docker Desktop,
PostgreSQL already migrated/seeded, and the installed service dependencies.
Do not run against production. Fixture commands refuse `NODE_ENV=production`.

The workload calls learning-service directly with the gateway identity headers.
Measurements **exclude gateway/JWT and tenant network calls**:
`TENANT_CLIENT_MODE=fake` returns Active with `TENANT_FAKE_TIMEZONE=Asia/Ho_Chi_Minh`.
course-service is real. Keep both services' default pg pool of 10 and
`COURSE_SERVICE_TIMEOUT_MS=3000`. The limiter stays at the default 10/minute/user.
Use one learning-service process: limiter storage and snapshot single-flight
are in process. Horizontal scaling requires shared limiter storage.

## Start services

Build both services using `npm run build` in their respective directories.
Ensure their `.env` values point to the same internal key and the Docker DB port.
If the local `.env` still uses 5432 while Docker exposes 5433, the commands below
override the port in the process only. Replace 5433 if Docker exposes another port.

In a terminal at `services/course-service`:

```powershell
$env:TS_NODE_BASEURL='./dist'
node -r dotenv/config -r tsconfig-paths/register -r ../../perf/learning/observe-course.cjs -e "const u=new URL(process.env.DATABASE_URL);u.port='5433';process.env.DATABASE_URL=u.href;require('./dist/src/main.js')"
```

In another terminal at `services/learning-service`:

```powershell
$env:NODE_PATH=Join-Path (Get-Location) 'dist'
$env:TENANT_SERVICE_URL='http://127.0.0.1:1'
node -r dotenv/config -e "const u=new URL(process.env.DATABASE_URL);u.port='5433';process.env.DATABASE_URL=u.href;require('./dist/src/main.js')"
```

`TENANT_SERVICE_URL` is needed to construct the existing learner lookup client;
UC25.3 never calls that client. Do not use this URL for other UCs that need lookup.
`observe-course.cjs` is an optional local preload that counts incoming I1/I2 calls
inside the real course-service process. It does not proxy requests or change
responses. Its local-only counter endpoint is `http://127.0.0.1:18084`:
GET reads counts and DELETE resets them. Stop this process after measurement.

## Fixture and connectivity

```powershell
docker pull grafana/k6
docker run --rm --mount "type=bind,source=$PWD/perf/learning,target=/scripts,readonly" grafana/k6 run /scripts/connectivity.js
$env:PERF_DB_PORT='5433'
node perf/learning/fixture.cjs seed
```

The connectivity check requires an unauthenticated request to reach the host
learning-service and return 401. No fixture writes happen in this check.

Fixed organization: `25030000-0000-4000-8000-000000000001`.
Measured Public/Published Course: `25030001-0000-4000-8000-000000000001`.
The tree has one module, one active lesson, and one required Reading material.
One snapshot set is one Course snapshot plus one material snapshot;
`lesson_snapshots` is sparse and correctly contains zero rows for active lessons.

There are 2,000 deterministic learner identities:
`25031000-0000-4000-8000-000000000001` through
`25031000-0000-4000-8000-000000002000`. They need no tenant/identity rows because
learning-service trusts the authenticated gateway headers and tenant access is fake.
The fixture also creates 100 other Public/Published Course rows and 50,000 background
Enrollments (500 per Course) within the perf organization. Background learners use
a separate `2503b000` prefix. No D47 demo IDs or records are changed.

`seed` clears/recreates perf learning data and is intentionally destructive only
within this fixture. `reset` removes target-Course Enrollment/progress/interval rows;
`reset --snapshot` also removes its snapshots and resets its `locked_at`.
All deletions filter the perf organization and fixed Course IDs, or the fixed
organization plus IDs of fixture-owned course assets. Ownership is checked first.
Each reset cleans before a run; the cleanup command below cleans at the end.

## Workloads

```powershell
./perf/learning/run.ps1 -Label a-limit -Mode A -UserOffset 0
./perf/learning/run.ps1 -Label b2-cold -Mode B -Vus 2 -UserOffset 100
./perf/learning/run.ps1 -Label b200-cold -Mode B -Vus 200 -UserOffset 200
./perf/learning/run.ps1 -Label b1000-cold -Mode B -Vus 1000 -UserOffset 500
node perf/learning/fixture.cjs explain
./perf/learning/run.ps1 -Label b200-warm -Mode B -Vus 200 -UserOffset 1500 -Warm
node perf/learning/fixture.cjs cleanup
```

The runner invokes `docker run --rm ... grafana/k6 run` and automatically loads
`INTERNAL_SERVICE_KEY` from the learning `.env` if the environment does not supply it.
It never prints the key. It resets the target Course before every cold level,
preserves its snapshot for warm mode, and resets the I1/I2 counters per run.
Warm mode must follow a cold run with a completed snapshot. Distinct learner offsets
avoid consuming previous runs' quotas; on rerun wait at least 60 seconds or choose
unused identities within the 2,000-person range. Do not raise the limit.

A sends 15 requests from one learner during approximately 10 seconds and one request
from each of five other learners concurrently. Thresholds require 6 total 201s
(1 main + 5 other), 9 ALREADY_ENROLLED 409s, and 5 RATE_LIMITED 429s, with consistent
Retry-After/body seconds. B gives each VU one distinct learner and one request.

Thresholds require zero 5xx, zero timeouts, zero unexpected responses, and the exact
number of 201s. SQL verification independently requires the expected Enrollment
count, zero duplicate (learner_id, course_id), one snapshot set, and zero orphans.
The proposed 200-VU p95 target is <500 ms; missing it returns nonzero. Report the
bottleneck and keep application code, pool, timeout, and thresholds unchanged until
an optimization is approved. If the machine cannot sustain 1,000 VU, keep the failed
evidence and report the highest stable workload rather than rerunning with tuning.

For a manual Docker invocation, create `perf/learning/results` and supply the key in
the environment first:

```powershell
docker run --rm --mount "type=bind,source=$PWD/perf/learning,target=/scripts,readonly" --mount "type=bind,source=$PWD/perf/learning/results,target=/results" --env INTERNAL_SERVICE_KEY --env MODE=B --env VUS=200 --env USER_OFFSET=200 --env LABEL=manual grafana/k6 run --out json=/results/manual-samples.json /scripts/uc25.3.js
```

Environment options: `BASE_URL` defaults to `http://host.docker.internal:8085`;
`MODE=A|B`, `VUS=2|200|1000`, `USER_OFFSET`, `LABEL`, and `INTERNAL_SERVICE_KEY` are k6
options. Fixture options are `DATABASE_URL`, optional `COURSE_DATABASE_URL`, and
optional `PERF_DB_PORT`. The fixture loads learning `.env` without overriding
environment values. The PowerShell runner passes the default BASE_URL; set it via
`--env BASE_URL=...` for a manual invocation against another local address.

## Evidence

All machine-dependent output stays in ignored `results/` and must not be committed:

- `*-summary.json`: k6 metrics and threshold results, p50 (`med`), p95, p99, max.
- `*-samples.json`: raw points, HTTP status distribution, latency over time.
- `*-course-calls.json`: actual I1/I2 ingress calls and finished response codes.
- `*-pg-activity.json`: 100 ms samples of connections, state, wait events, active query age.
- `*-sql.json`: post-run Enrollment/snapshot/duplicate/orphan checks and table size.
- `*-report.json`: aggregate latency, throughput, errors, connection timing, calls, SQL.
- `explain.txt`: EXPLAIN (ANALYZE, BUFFERS) BR-298 and INSERT after the largest level;
  the INSERT runs inside a transaction that always rolls back.

`explain` refuses fewer than 50,000 rows and fails with CẦN QUYẾT ĐỊNH if BR-298
still uses Seq Scan. Run it before resetting the largest level's data.
Inspect latency raw points for increasing completion times, pool-sized plateaus,
`http_req_blocked`/`http_req_connecting`, 5xx/timeouts, and pg_stat_activity lock waits.
The observer has its own connection; learning's monitoring connection is excluded
from activity counts. pg_stat_activity cannot directly prove a Node pool wait queue;
distinguish observations from inference. HTTP status 0 means a network failure,
not a 5xx; raw points retain k6 error codes. Throughput includes connection/setup
delays in the k6 run. HTTP duration percentiles exclude connection establishment.

Record host CPU/RAM, Docker `NCPU`/`MemTotal`, and observed resource use beside the
local results. Container measurements are specific to that machine and run.
