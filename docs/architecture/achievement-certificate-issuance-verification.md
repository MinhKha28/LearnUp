# Automatic certificate issuance verification

Date: 2026-10-24. Scope: PR1, automatic issuance on EnrollmentCompleted.
Base: `feat/storage/private-delivery` at `098cccb`. UC34 list/detail/PDF,
certificate holders and UC34.3 configuration remain for later work.

## Receiving and persistence

The Kafka dependency is pinned to `@confluentinc/kafka-javascript` 1.11.0.
The consumer group is `achievement-reporting-certificate-v1`, initial offset
policy earliest, automatic commits disabled. `CERTIFICATE_CONSUMER_ENABLED`
defaults false. Receipt/Pending and quarantine transactions commit before the
consumer explicitly commits offset + 1. A database failure leaves the offset
uncommitted. The adapter's retry-on-handler-error behavior was checked in the
installed SDK source; real-broker delivery is distinguished from callback tests.

Completion payload validation includes envelope v1, producer, topic key identity,
organization identity, dates, Optional late/deadline rules, and the exact object
snapshot schemaVersion 1. Quiz/Assignment scores remain decimal strings. The
original assessment snapshot is stored without fetching current scores.
Unknown completion fields/versions are quarantined, rather than guessed.

An event ID receipt and Certificate are written together. Stable canonical-data
SHA-256 detects contradictory repeats. Transaction advisory locks serialize event
ID, enrollment and learner/version identities in sorted order. Their SQL uses
`$executeRaw` because PostgreSQL advisory lock returns void; locking remains
transaction-scoped. A unique code collision regenerates at most three times,
then throws for redelivery, unlike an identical event which succeeds idempotently.
Conflicting data is durably quarantined, warned and never overwrites a Certificate.

`completion_event_quarantine` records topic, partition, offset, readable event ID,
reason, payload and received time; topic/partition/offset is unique. Only after
this transaction commits is a bad message acknowledged, so the next learner is
not blocked. Invalid UTF-8/JSON, NUL/unpaired Unicode, nonfinite JSON numbers and
excessive nesting use a lossless rawBase64 payload wrapper where PostgreSQL jsonb
cannot represent the original. Logs contain only reason and delivery position,
never the quarantine payload. Quarantine has no public API or replay script.

## Issuance and storage

The worker claims due Pending rows with SKIP LOCKED and a lease token, default
concurrency four, default poll 1 second and lease 120 seconds. Issuing requires
the same token and a live lease. REST, logo download and upload occur outside
transactions. Failure increments attempts and schedules 60/120/240/300 seconds
with 10 percent jitter capped at 300; no terminal Failed state exists. Once per
roughly 60 seconds of polling, Pending older than an hour causes an aggregate
warning. The repository also exposes backlog, oldest Pending and technical delay
percentiles for the measurement harness; these are not public endpoints.

Tenant users lookup is a real client, reading by stable user ID including deleted
accounts. Its current Organization body is populated identically to the request
header. Profile/Course use independent http/fake modes; fake is opt-in and only
permitted with NODE_ENV development/test. No HTTP failure falls back to fake.
Requests use x-internal-key and x-organization-id, without x-user-id, SYSTEM or
user-role headers. x-service-name is metadata only. Tenant header/body enforcement
remains the Tenant owner's work. Profile 404/auth errors are configuration warnings
and retry at the same capped schedule; 503/network failures also remain Pending.

Logo URLs are transient and never persisted. Download allows HTTPS only, exact
configured hosts (default res.cloudinary.com), no credentials/nonstandard port,
no redirects, bounded time and body length. Magic bytes permit PNG/JPEG/WebP;
response/profile MIME does not determine the stored type. Download 404 refreshes
the profile once. No logo still permits Issued.

Cloudinary uses the shared storage provider, authenticated delivery,
overwrite=false and keys
`achievement/<organizationId>/certificates/<certificateId>/logo/<attemptId>`.
Only key, SHA-256, detected MIME and size are stored. Each attempt owns its asset;
a losing attempt cannot delete the winner's key. An ambiguous database commit
checks whether its own key is referenced before best-effort deletion. Cleanup
failure or inability to verify ownership logs the attempt key for follow-up.
Credentials are environment-only and never printed in this verification.
No PR1 Cloudinary live smoke was run; storage is fake in automated checks.
The separate shared-library live verification is recorded in
[storage verification](storage-private-delivery-verification.md).

Kafka import is dynamic so a disabled consumer does not require a native addon,
and a load/connect failure is caught in the background startup path. A test
injects a native-loader failure, checks startup does not throw and logs omit the
error, then recovers with a transport double. The actual Windows native addon
also imported successfully after its installation script was explicitly approved.
Missing Kafka, Tenant, Course or Cloudinary never blocks Nest construction;
requests requiring unavailable data remain Pending. PostgreSQL remains the existing
startup dependency. Invalid configuration (including fake mode outside dev/test)
is rejected rather than silently weakening production behavior.

## Migration and business-rule mapping

Read-only catalog inspection found an empty achievement_reporting_db on
PostgreSQL 16.15, no Prisma history and no uuidv7 function. With separate approval,
`20261024000000_certificate_issuance` was applied through Prisma migrate deploy.
It creates the five pre-existing Prisma models plus receipt and quarantine.
GĐ2 evaluation/export behavior and its additional design constraints are not
implemented by PR1; those baseline models are not a claim of completed GĐ2 work.

Certificate CHECKs enforce Pending/Issued, Crockford codes, eligible object
snapshot v1, nonnegative attempts, coherent leases/assets/signers, and required
Issued fields. Trigger requires insertion as Pending, freezes event data from
the start, permits one snapshot write at Pending-to-Issued, blocks reverse
transition and all edits/deletes after Issued, and blocks Pending deletion.
The partial index (organization_id, learner_id) WHERE status='Issued' is present
for later certificate-holders keyset paging. No such endpoint is added now.

New BR numbers are used here: BR-262 uniqueness, BR-263 snapshot content,
BR-264 code, BR-265 late marker, BR-267 retention, BR-269 score snapshot,
BR-270 immutability and BR-271 issued_at = event completedAt. No grading label
is produced (BR-190). issued_recorded_at captures technical completion, distinct
from the immutable issue date. Organization name/logo are snapshots. Signer name,
title, key/hash/MIME columns are included now but remain null in PR1.

Approved departures from the older database document: snapshot is an object,
receipt/quarantine are added, retry uses the new cap, Cloudinary replaces MinIO,
per-attempt assets replace a shared logo key, and UUID v7 is supplied by the
application/Prisma on PostgreSQL 16 rather than a database uuidv7 function.
The code uses the current course/profile service-call contracts without inventing
user context. The Tenant profile endpoint (#148) is still an owner dependency;
the Course contract (#146) must be deployed before production HTTP issuance.

## Tests and build evidence

The checks are run from the isolated PR1 checkout. PostgreSQL tests create their
own ar1_test_<random> schema and drop it in finally, including failure paths;
baseline Certificate/receipt/quarantine counts remain zero. No production or
customer data, live storage, database reset or global environment file is used.

- Build and full suite: 76 tests passed (47 unit tests, 28 PostgreSQL subtests
  plus their parent).
- PostgreSQL checks cover direct unique violations, Crockford/object CHECKs,
  duplicate concurrent deliveries, collision retry/exhaustion, contradictory
  events, protected Pending fields, complete issuance, deleted-account-compatible
  lookup, dependency recovery, no signer/logo, original completedAt, Issued
  immutability, disjoint claims, expired leases, quarantine durability and metrics.
- Mock tests cover header/body Organization equality, no user context, profile
  errors and fake restrictions, logo allowlist/magic/body cap, profile refresh,
  orphan cleanup including ambiguous commit, offset ordering and native failures.
- Changed-file lint passes. Full-service lint also revealed 11 existing formatting
  errors in untouched decorator/guard/interceptor/main/platform-setting DTO files;
  those unrelated files were not reformatted by PR1.
- Compose configuration validates using the example environment plus synthetic
  validation-only values, with quiet output; real environment files are not read.
- Final Linux Docker build passed. A service-specific Docker ignore file keeps
  host dependency junctions, generated artifacts and environment secrets out of
  the build context; this also resolved a host-junction COPY conflict.
- The opt-in container startup check returned HTTP 200 from `/docs-json` with
  the consumer enabled, Kafka/Tenant/Course unavailable and Cloudinary absent.
  Its seeded Certificate remained Pending after an unsuccessful attempt. The
  actual Kafka native addon loaded inside the Linux runtime. The temporary
  container and isolated test schema were cleaned in finally. No live broker
  delivery or Cloudinary upload is claimed by this check.
- Read-only Prisma schema comparison after migration reports no difference
  between the target database and the declared schema.
- Installation audit reports four existing Nest dependency findings: high
  platform-express/multer and moderate swagger/js-yaml. Shared-library builder
  installs also report pre-existing dev dependency findings, including critical
  ones. No automatic dependency upgrades/audit-fix are included in PR1. These are
  findings to address in their owning dependency work, not a security audit pass.

## Synthetic measurements

Measured 2026-10-24. Each row is 100 completions, worker on, concurrency four,
20 ms poll, 120-second lease; six isolated runs. Directory/profile/Course,
storage and logo fetch are in-memory fakes. Kafka is a direct invocation of the
consumer handler with a commit callback, not a real broker. PostgreSQL is real.
Fake logo bytes contain only a PNG signature, exercising copy bookkeeping but
not Cloudinary image decoding. This is not deployed integration or capacity data.

Topology: one host Node 22.23.3 process, Windows 10.0.26200 x64, Intel i7-12700H,
20 logical CPUs, 15.63 GiB RAM; PostgreSQL 16.15 in an existing local Docker
container reached over loopback. No Gateway or other live business service.

| Scenario/run | p50 ms | p95 ms | p99 ms | Certificates/s | Peak backlog | Peak oldest Pending s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| No logo 1 | 11.304 | 15.214 | 37.052 | 116.723 | 1 | 0.034380 |
| No logo 2 | 11.173 | 27.586 | 35.054 | 126.875 | 4 | 0.029681 |
| No logo 3 | 10.375 | 18.423 | 26.806 | 138.982 | 2 | 0.014105 |
| Fake logo 1 | 10.435 | 18.608 | 27.083 | 132.646 | 2 | 0.013158 |
| Fake logo 2 | 9.712 | 11.100 | 12.655 | 143.021 | 1 | 0.014964 |
| Fake logo 3 | 9.769 | 11.286 | 13.223 | 142.945 | 1 | 0.012327 |

All six runs: exact 100 Issued / 100 receipts / 100 commits, zero quarantine,
zero final backlog. Percentiles measure issued_recorded_at minus event completedAt,
not HTTP response latency. Polling samples can miss a brief backlog peak.
No 500 ms SLA or HTTP baseline-regression threshold is applied to issuance.
Worker-off behavior is tested through the disabled startup/configuration cases;
these throughput measurements only apply with the worker enabled.
The reusable script is `perf/achievement/certificate-issuance.cjs`; raw result
files under its results directory are ignored rather than committed.

PR3 list/PDF load work remains separate: median p99 of three comparable baseline
runs, stop when two of three candidate p99 values exceed max(500 ms, 1.5 times
baseline), error rate exceeds one percent, or certificate counts are wrong.
