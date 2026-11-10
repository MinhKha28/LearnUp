# L17 assessment access verification

## Scope and baseline

Baseline: origin/develop at 95a3e21, containing L6 commits 3c7649b, 6e8ce1c and 1de7dde.
Only learning-service, its tests, the REST contract and performance/verification artifacts change.
The internal endpoint returns `{ enrollmentId, status, access }` inside the existing `data` envelope.
It uses one Enrollment lookup by unique Learner/Course-version key with an organization predicate,
selecting only `id` and `status`. No join, migration, external service call or overdue calculation is needed.
Unknown stored status produces a logged 500. No extra role restriction is applied.
T3 remains unchanged: authentication failures are 401 without a business error code.

## Correctness checks

- Unit command: `npm run test:unit` in `services/learning-service`, with `NODE_PATH` set to that service directory.
- Integration command: `npm run test:integration` in the same directory, with the existing L6 PostgreSQL/Course test connection settings.
- Unit: 251/251 passed. Integration: 174/179 passed, 5 skipped, zero failed/cancelled. The five skipped tests are opt-in L6 PostgreSQL/Kafka relay tests.
- Integration uses real PostgreSQL and the Nest HTTP stack; some existing dependency calls use test stubs. This is not a full deployed business-flow verification.
- L17 coverage includes all six stored statuses, past-due active statuses, missing and foreign-organization Enrollment, malformed/repeated/unknown query parameters, missing/invalid internal key and missing context, and course-ids stored status.
- OpenAPI YAML parsed with the already-installed `js-yaml`; build and whitespace checks pass.

## Environment and reproduction

Measured on 2026-10-23 (Asia/Saigon). Windows host: Intel Core i7-12700H, 20 logical processors,
16,781,979,648 bytes physical RAM. Docker Linux VM: 20 CPUs, 8,128,454,656 bytes RAM.
Learning runs on the existing L6 Node 22.23.4 Alpine image with locally compiled L17 `dist` copied in;
PostgreSQL 16.15 uses `postgres:16-alpine`; k6 is 2.3.0 (linux/amd64). The existing Course test container is also running.
No new dependency installation or database migration is required for this reproduction.

Build using existing dependencies with `npm run build` from `services/learning-service`.
Create a disposable container from the existing L6 learning image, pass its existing test environment,
override command to `node dist/src/main.js` (bypass the image migration entrypoint), and copy
`services/learning-service/dist` into the service's `dist` directory before starting.
The container used by the runner is `learnup-l17-learning-ready`, on `learnup-l6-test_learnup-network`.
The existing database is `learnup-l6-postgres`. The runner reads test credentials into process environment
from these containers without printing or persisting them. Kafka stays stopped and outbox relay is enabled.

From the repository root, run `perf/learning/uc29-run.ps1`, then `node perf/learning/uc29-report.cjs`.
The runner creates and cleans a reserved synthetic organization with **50,000 Enrollment rows**:
one Course version, 50,000 distinct Learners, Optional NotStarted, expected Full access.
The hot path correctness for other statuses is verified by integration tests, not this latency workload.
A shared k6 fixture array prevents per-VU copies. The initial low-load runs were started before enabling this
memory optimization; HTTP request metrics below still exclude initialization.

Each level is 1, 2, 100, 200, 1000 or 2000 VUs, with three independent sequential repetitions.
Each repetition ramps from zero to target for 15 seconds, then holds target for 60 seconds.
One synchronous GET per VU, no think time; VUs represent concurrent callers, not guaranteed exact
in-flight requests at every instant. Request timeout is 10 seconds.
Only requests started in the 60-second hold window feed reported latency/error metrics.
Throughput is completed steady-tagged requests divided by 60 seconds; drain completions can extend past the window.
Every response is checked for HTTP 200 and exact enrollmentId/status/access against its fixture.
`docker stats --no-stream` samples Learning and PostgreSQL CPU/RAM approximately every two seconds,
including warm-up; the table reports observed peaks, not continuous maxima. Docker CPU can exceed 100%
when a process uses more than one logical core. k6, Learning, PostgreSQL and Course share the same VM;
these measurements are local capacity evidence, not a production SLA.

No latency thresholds are configured. The runner stops on HTTP/content errors or failed k6 execution
before trying higher loads, preserving actual results without extrapolation.
Raw summaries, resource samples, fixture and console logs are local ignored artifacts under
`perf/learning/results/uc29-*`; no credentials or absolute local filesystem paths are included here.

## Results

|  VUs | Run |  p50 ms |  p95 ms |  p99 ms |   req/s | HTTP errors % | Timeouts % | Learning CPU peak % / RAM MiB | PostgreSQL CPU peak % / RAM MiB |
| ---: | --: | ------: | ------: | ------: | ------: | ------------: | ---------: | ----------------------------: | ------------------------------: |
|    1 |   1 |    0.94 |    1.96 |    3.41 |  784.10 |          0.00 |       0.00 |                93.11 / 205.40 |                  29.55 / 172.00 |
|    1 |   2 |    0.91 |    1.71 |    2.85 |  861.32 |          0.00 |       0.00 |                92.40 / 206.00 |                  23.88 / 172.60 |
|    1 |   3 |    0.90 |    1.45 |    2.39 |  837.52 |          0.00 |       0.00 |                90.80 / 205.70 |                  21.34 / 172.00 |
|    2 |   1 |    1.09 |    2.50 |    4.24 | 1254.65 |          0.00 |       0.00 |               108.17 / 209.70 |                  33.60 / 174.60 |
|    2 |   2 |    1.01 |    2.01 |    3.17 | 1428.70 |          0.00 |       0.00 |               107.19 / 209.10 |                  37.01 / 174.70 |
|    2 |   3 |    1.01 |    1.75 |    3.00 | 1532.20 |          0.00 |       0.00 |               108.37 / 209.90 |                  36.49 / 174.40 |
|  100 |   1 |   51.93 |   71.05 |   91.71 | 1772.85 |          0.00 |       0.00 |               115.06 / 229.60 |                  46.45 / 190.40 |
|  100 |   2 |   51.46 |   61.33 |   72.65 | 1704.80 |          0.00 |       0.00 |               112.72 / 230.40 |                  47.74 / 190.50 |
|  100 |   3 |   58.16 |   85.38 |  112.58 | 1468.28 |          0.00 |       0.00 |               115.00 / 230.30 |                  48.32 / 190.70 |
|  200 |   1 |  112.35 |  192.91 |  262.46 | 1429.17 |          0.00 |       0.00 |               118.85 / 247.50 |                  45.09 / 193.70 |
|  200 |   2 |  109.28 |  145.24 |  193.96 | 1573.12 |          0.00 |       0.00 |               120.51 / 247.60 |                  43.57 / 194.60 |
|  200 |   3 |  107.27 |  119.48 |  127.31 | 1760.77 |          0.00 |       0.00 |               117.25 / 248.30 |                  42.03 / 193.90 |
| 1000 |   1 |  536.94 |  762.26 | 1054.77 | 1697.13 |          0.00 |       0.00 |               120.76 / 356.60 |                  42.27 / 193.10 |
| 1000 |   2 |  559.21 |  828.11 | 3564.16 | 1576.60 |          0.00 |       0.00 |               127.16 / 356.70 |                  43.30 / 191.10 |
| 1000 |   3 |  571.66 |  797.62 | 3314.20 | 1594.73 |          0.00 |       0.00 |               122.88 / 358.60 |                  42.57 / 193.50 |
| 2000 |   1 | 1322.66 | 1729.93 | 5450.85 | 1381.10 |          0.00 |       0.00 |               133.75 / 492.00 |                  41.85 / 190.90 |
| 2000 |   2 | 1128.78 | 1768.23 | 4327.75 | 1478.53 |          0.00 |       0.00 |               127.99 / 492.90 |                  44.00 / 190.90 |
| 2000 |   3 | 1125.56 | 1308.76 | 1609.39 | 1736.27 |          0.00 |       0.00 |               126.55 / 493.00 |                  46.75 / 190.70 |

All 18 repetitions completed. HTTP error and timeout rates were zero and all payload checks passed. The host sustained all requested levels; no extrapolation or latency acceptance threshold was used. Throughput plateaued while queueing latency increased at high concurrency; profile application/DB pool scheduling before proposing optimization. These observations alone do not identify the bottleneck.

## Query plan

Representative parameterized SQL matching the repository lookup:

```sql
SELECT id, status FROM enrollments
WHERE learner_id = $1 AND course_id = $2 AND organization_id = $3
LIMIT 1;
```

`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` on the synthetic fixture:

- Limit -> Index Scan using `enrollments_learner_id_course_id_key`.
- Index condition: learner_id and course_id; organization_id is a filter on the unique row.
- Actual rows: 1; rows removed by filter: 0; shared buffer hits: 4; shared reads: 0.
- Planning time: 0.095 ms; execution time: 0.042 ms.
- No join or sequential scan. The existing unique index is sufficient for this query shape.

## Kafka unavailable check

The container started successfully with OUTBOX_RELAY_ENABLED=true while learnup-l6-kafka remained stopped. During the measured workload, all completed checks received the expected 200 payload. The relay logged OUTBOX_BROKER_UNAVAILABLE and kept retrying without preventing HTTP access. No Kafka shutdown command or migration was needed.

## Limitations and deviations

An initial Docker build was inadvertently started before inspecting its Dockerfile and reached its
`npm install` layer without the requested prior confirmation. It was interrupted; the resulting build
was not used for verification. Subsequent checks use existing dependencies and the existing L6 image,
with no migration. A first preparation attempt lacked Course timeout configuration and did not start;
its failed k6 output is excluded. The measured runs use the fully configured replacement container.
