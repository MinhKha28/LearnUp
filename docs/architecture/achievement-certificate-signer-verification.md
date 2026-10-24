# Certificate signer settings verification

PR2 implements backend UC34.3 on certificate issuance baseline `8acec00` and
private storage S1 `e3e8b0b`. Frontend and PDF rendering remain later work.
BR-17 governs Organizer read-only access; BR-263/BR-270 govern issuance snapshots
and immutability. The new signature rule has no assigned BR number.

## Storage and schema

The new migration creates one settings row per Organization and durable
`storage_cleanup_tasks`. The PR1 migration is unchanged. Settings require a
nonblank name/title, a positive version, and all-or-none key/hash/MIME/size.
Signature MIME is PNG/JPEG in settings and Certificate CHECKs; logo MIME remains
PNG/JPEG/WebP. Certificate has the existing nullable signature key/hash/MIME
columns; no additional Certificate size column is needed by this contract.

Every achievement asset is `image/authenticated`. Upload, delete and read pass
that type explicitly. No public or signed storage URL is persisted or returned.
Source keys use `achievement/<org>/certificate-signer/signature/<assetId>`;
Certificate copies use `achievement/<org>/certificates/<id>/signature/<attemptId>`.
IDs are fresh UUID v7 values and uploads use overwrite=false. SHA-256 is computed
from input bytes and checked again before snapshot copying and preview delivery.

No dependency was added. FileInterceptor uses its default memory storage with
explicit file/field/part limits. The local upload interface contains only
fieldname, originalname, mimetype, size and buffer. Package files and the
achievement lockfile are unchanged.

PNG IHDR/JPEG SOF headers provide dimensions without native libraries or image
decoding. The limits are 2 MiB, 4096 pixels per side and 16 million total pixels.
The application preserves input bytes, including PNG alpha, and does not remove
backgrounds or perform full image decoding/CRC validation. Cloudinary still
validates uploaded images. Client MIME is ignored in favor of magic bytes.

## API and access

The three operations are described in
[the OpenAPI contract](../../contracts/openapi/achievement-reporting-service.yaml).
All require Organizer and a valid Gateway organization/user UUID. Tenant is the
owner of Organization/subscription lifecycle; the new HTTP client calls
`GET /api/v1/internal/organizations/:id/access` with internal key, matching
organization header and service name, without invented user context.
The expected data has organizationId, organizationStatus and subscriptionStatus.
Non-Active Organizations and Suspended/Ended subscriptions cannot write. Grace
permits writes. GET operations do not query Tenant. Tenant failures return 503,
never a permissive fallback. Fake access is explicit and restricted to dev/test.

PUT validates text/action/file and If-Match before Tenant access, uploads a new
image before opening the DB transaction, then saves settings and queues cleanup
atomically. A missing If-Match returns 428; stale versions return 412. Names use
NFC/trim and Unicode code point lengths, and reject controls/unpaired surrogates.
Unknown/repeated multipart fields and inconsistent file actions return 400.
Oversize returns 413; unsupported magic bytes returns 415. Preview returns bytes
with the detected MIME, no-store and nosniff through an explicit RawResponse
marker, bypassing the success JSON transformer. No whole-settings DELETE exists.

## Issuance and concurrency

Settings writes and the final issuance transaction acquire the same PostgreSQL
transaction advisory lock per Organization. This also serializes the absent-row
version 0 case. Two PUTs with one version cannot both succeed. The final
Pending-to-Issued UPDATE checks the current settings version, Organization and
live lease; it records name/title/key/hash/MIME together with PR1 snapshots.
Network and storage operations stay outside DB transactions.

A changed version releases the current issuance lease for immediate retry without
incrementing infrastructure failure attempts. Lost/expired leases are distinct
from version conflicts. A signature NOT_FOUND refreshes settings once; a missing
configuration still issues without a signer. Configured image failures or hash
mismatches keep the Certificate Pending and use PR1 retry/backoff. Changing settings
never updates an already Issued Certificate; its original trigger remains active.

## Cleanup and operations

Replacing/removing an image queues its previous key in the settings transaction.
A failed PUT after upload queues its new key in a separate transaction; a failure
to enqueue logs CERTIFICATE_SIGNER_ORPHAN_CLEANUP_REQUIRED without dependency
errors. Issuance attempts enqueue unused keys before their existing immediate
best-effort delete; ambiguous commits are protected by reference checks.

Cleanup uses SKIP LOCKED and lease fencing. It checks both Certificate logo and
signature keys and current settings before deletion. Both deleted and not_found
complete the task. Referenced keys are deferred; errors persist attempts and
jittered PR1 backoff (maximum 300 seconds). Successfully completed tasks are
removed. An expired worker cannot acknowledge/retry another worker's lease.
Warnings include only safe codes, counts/ages or internal asset keys.

A process killed between upload and durable task insertion can still leave an
untracked asset. An upload with an uncertain provider result can likewise need
operator reconciliation. This queue covers recorded failures and does not claim
to be a bucket-wide orphan reconciler.

| Configuration | Default | Constraint |
| --- | --- | --- |
| CERTIFICATE_SIGNER_ACCESS_CLIENT_MODE | http | fake only in development/test |
| CERTIFICATE_CLEANUP_ENABLED | true | independent of consumer; explicit false disables cleanup |
| CERTIFICATE_CLEANUP_DELAY_MS | 600000 | strictly greater than issuance lease + read timeout |
| CERTIFICATE_CLEANUP_POLL_MS | 1000 | 1..60000 |
| CERTIFICATE_CLEANUP_LEASE_MS | 120000 | greater than read timeout |
| CERTIFICATE_CLEANUP_WARN_SECONDS | 3600 | warn on due backlog age |

Cleanup is enabled by default independently of CERTIFICATE_CONSUMER_ENABLED,
including API-only deployments with issuance disabled. Compose passes
CERTIFICATE_CLEANUP_ENABLED with a true fallback; the service .env.example sets
it explicitly. Setting false disables the worker regardless of consumer state.

If any CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET is
missing/blank, the worker logs CERTIFICATE_CLEANUP_STORAGE_UNCONFIGURED once per
worker instance. It does not claim, process or retry tasks while storage is
unconfigured and does not reject service startup. Configure storage and restart
the service to begin draining those tasks. No credentials are included in logs.

## Verification

The complete suite passes 129/129 tests with zero skips: all 81 PR1 tests plus
48 PR2 unit/HTTP/PostgreSQL tests. The cleanup follow-up covers omitted/true/false
flags with either consumer state, actual polling with consumer disabled, and
each missing Cloudinary variable producing only one warning without task access.
PostgreSQL runs create random ar1_test_* schemas, apply SQL only within them and
drop them in finally. They do not run Prisma migrate or change deployment tables.
The tests cover two concurrent PUTs, multipart errors, byte preview, cleanup
lease/retry/reference guards, absent-row and changed-version issuance races, and
Issued immutability. The full service also starts and serves the API with Kafka
unreachable and Tenant fake. Native Kafka delivery was not reverified here.

Build and changed-source ESLint pass. Full-service ESLint has three pre-existing
Prettier errors in internal-auth.guard.ts, main.ts and update-platform-settings.dto.ts;
those files are unchanged. No lint fix or dependency upgrade was applied.

A short live Cloudinary smoke used only the three approved environment variables,
random authenticated keys, a valid generated 3172-byte PNG and cleanup in finally.
It passed upload, exact-byte preview, replacement, delayed worker deletion,
snapshot copy and hash checks, with zero errors and zero remaining test assets.
Cleanup absence was checked with a second authenticated delete returning not_found.
The shortened cleanup delay was 6500 ms, greater than its test issuance lease
(1000 ms) plus read timeout (5000 ms). No Docker create/start/stop was used.

## Light measurements

Topology: Windows 10.0.26200, Intel Core i7-12700H, 20 logical CPUs, 15.6 GiB RAM,
Node v22.23.3; PostgreSQL 16.15 in an existing Docker container over loopback.
HTTP requests were sequential on loopback with fake Tenant access and no Kafka.
These are observations, not an SLA or a deployed end-to-end load test.

| Operation, PostgreSQL + memory storage | Samples | p50 ms | p95 ms |
| --- | ---: | ---: | ---: |
| GET settings | 30 | 1.88 | 4.46 |
| PUT text | 30 | 6.29 | 8.67 |
| PUT 2 MiB image | 20 | 13.84 | 17.86 |
| GET signature | 30 | 1.71 | 2.86 |
| Issuance with signature | 10 | 8.22 | 10.13 |
| Issuance without signature | 10 | 5.92 | 6.87 |

The 2 MiB memory fixture pads a valid PNG header/file for the agreed header-only
validator; it is not evidence of live Cloudinary accepting a 2 MiB image. This
run had zero errors; memory upload p50/p95 was 1.38/1.55 ms and reads 0/0.01 ms.

| Live Cloudinary smoke operation | Samples | p50 ms | p95 ms |
| --- | ---: | ---: | ---: |
| GET settings | 3 | 6.78 | 51.95 |
| PUT text | 3 | 15.53 | 24.01 |
| GET signature | 3 | 531.09 | 1008.54 |
| Storage upload | 3 | 1068.74 | 1676.20 |
| Storage read | 5 | 464.93 | 1004.50 |
| Storage delete through cleanup worker | 1 | 1152.75 | 1152.75 |

Live first-image PUT was 1686.75 ms; replacement 966.10 ms. Those HTTP/storage
smoke observations use small sample counts and cannot estimate production
capacity. The earlier single-sample issuance comparison is superseded by the
20-sample measurement below. Each copied signature costs a storage read, upload
and retained asset.

### Sequential live issuance measurement

On 2026-10-25 (Asia/Saigon), the unchanged worker at baseline 4848eca was measured
with 20 signed Certificates followed by 20 unsigned Certificates, all sequential.
The topology is the Windows/i7-12700H/20-logical-CPU/15.6-GiB machine, Node
v22.23.3 and PostgreSQL 16.15 described above. PostgreSQL and authenticated
Cloudinary were real; Learner/Course/Organization directory lookups were fake,
with no logo. Each signed Certificate copied the same valid 3172-byte source PNG
to a fresh per-attempt key. The unsigned Organization had no signer configuration.

Timing instruments were applied only to runtime instances in an external script.
Total spans worker.process(), excluding event receipt, lease claim, fixture setup
and cleanup. The SQL UPDATE is timed separately from the full finalization
transaction (advisory lock, lease/version reads, UPDATE and commit). The transaction
row already contains UPDATE time. p50 is the mean of ordered samples 10 and 11;
p95 is nearest rank, sample 19 of 20. Phase percentiles are independent and must
not be summed to obtain total percentiles.

| Phase | Signed samples | Signed p50 ms | Signed p95 ms | Unsigned samples | Unsigned p50 ms | Unsigned p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Read signer settings | 20 | 0.87 | 1.81 | 20 | 0.84 | 1.48 |
| Signature readBytes | 20 | 481.23 | 826.82 | 0 | N/A | N/A |
| Upload snapshot copy | 20 | 947.66 | 1054.99 | 0 | N/A | N/A |
| Issuance SQL UPDATE | 20 | 1.53 | 2.21 | 20 | 1.36 | 1.93 |
| Full DB finalization transaction | 20 | 8.87 | 12.03 | 20 | 5.89 | 8.24 |
| Other worker work | 20 | 0.11 | 0.33 | 20 | 0.02 | 0.03 |
| Total worker.process() | 20 | 1450.95 | 1884.06 | 20 | 6.70 | 9.75 |

All 40 samples reached Issued, with zero errors. The script deleted and verified
absence of all 21 random assets (source plus 20 copies) in finally; the verification
delete returned not_found for each. Zero test assets remained and the isolated
schema was dropped. This is a sequential small-image observation, not an SLA,
a large-image benchmark or an end-to-end deployment measurement.

## Asset ownership decision and later optimization

PR2 retains per-attempt Certificate keys for both signatures and logos. Shared
content-addressed assets are deferred because they require an asset registry and
coordination between uploads, pending references and garbage collection. A failed
worker must not delete an asset another Certificate uses; a global reference
check alone does not close the race with a concurrent finalization. The current
attempt-specific ownership and immutable Issued records remain unchanged.

A later optimization may cache signature bytes by (organizationId, settings
version), with bounded byte capacity and TTL. Cache entries would contain verified
bytes/MIME/hash, never signed URLs, and obey the same size/type limits. Reading the
current version and the final DB version fence remain mandatory; a new version
must not reuse old bytes, and read/hash failures must not populate the cache.
Caching can avoid repeated source reads while retaining per-attempt uploads and
cleanup ownership. No cache or shared-asset implementation is included in PR2.

## Remaining external verification

Tenant access was verified with mocked HTTP responses and explicit fake mode,
not against a deployed Tenant /access endpoint. Gateway traversal, proxy-wide
multipart limits, frontend and PDF rendering were not exercised. The smoke does
not establish Cloudinary costs, high-concurrency capacity or a production SLA.
