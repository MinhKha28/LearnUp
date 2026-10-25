# Shared storage protected delivery verification

Date: 2026-10-24. Branch: `feat/storage/private-delivery`.
Base: `origin/develop`, `87b5fe9`.

## Scope and decision

The original change extended `libraries/ts-storage` and this report. The S1 review
follow-up also updates only the delete return-type annotations of the Tenant and
Course unconfigured providers. Their business behavior, dependencies, public
delivery defaults and deployment configuration are unchanged. Achievement PR1
is stacked on this branch; PR2 is stacked on PR1.

For certificate logo/signature snapshots choose `authenticated`: the original
and derived assets require authorization. `private` alone does not protect
derived assets by default. This follows Cloudinary's
[access-control documentation](https://cloudinary.com/documentation/control_access_to_media#restrictive_delivery_types).
Folder separation does not supply authorization.

The additive delivery option uses Cloudinary values `upload` (public default),
`private`, and `authenticated`, as documented in the
[upload parameters](https://cloudinary.com/documentation/upload_parameters#delivery_types).
Existing calls omit `type` as before. Upload/delete options accept `deliveryType`;
the original two-argument `getUrl` remains public. Following S1 review, its overload
rejects `private`/`authenticated` and directs callers to `getSignedUrl`. No existing
service must implement the new read capability.

The new `getSignedUrl` uses the SDK's `private_download_url`, with caller-supplied
future UNIX-seconds `expiresAt`, resource type, format and delivery type. This is
an API download URL rather than a CDN transformation signature. Cloudinary
documents its expiry, available delivery types and lack of CDN caching in
[time-limited access](https://cloudinary.com/documentation/control_access_to_media#providing_time_limited_access_to_private_media_assets)
and the [Upload API reference](https://cloudinary.com/documentation/image_upload_api_reference#private_download_url).
At initial offline verification, no Cloudinary account had been exercised.

`getUrl` returns a public unsigned URL and rejects protected delivery types.
Signed URLs grant possession-based access until expiry,
so certificate services must retain them server-side. The library does not make
an end-user authorization decision. Public `upload` assets remain public even
if a caller creates a signed URL for them.

`readBytes` generates a signed API URL, requires `timeoutMs` and `maxSizeBytes`,
and enforces the cap both before reading (Content-Length) and during streaming.
It aborts stalled headers/bodies, cancels the stream on errors, rejects redirects,
and returns only bytes. Signing and reading failures omit original causes and
response bodies to prevent accidental signed-URL disclosure. Callers should
choose limits appropriate for the asset and concurrency; the helper buffers the
result in memory. No network retry or fallback to public delivery is performed.

The upload result retains `url`/`secureUrl` as strings for public consumers.
For protected assets these are only locators, not authorized download URLs;
callers must not persist, log or return them outside the service. Achievement must store only
the key, SHA-256, MIME and required format/delivery metadata, and never publish
those URL fields. The new methods use the existing SDK dependency (2.7.0).
No real credentials were added to code, documentation or logs; test credentials are
synthetic isolated fixtures. Initial verification made no live Cloudinary request;
the separately approved live run is recorded below.

## Course delivery finding and issue 146

Course currently uploads [video](../../services/course-service/src/modules/courses/courses.service.ts#L1209) to
`learnup/{organizationId}/courses/videos` with resource type `video`, and PDF
[reading material](../../services/course-service/src/modules/courses/courses.service.ts#L1543) to `courses/readings` with resource type `raw`. Neither call
sets a delivery type. Both therefore use public `upload` delivery.

The provider factory instantiates the shared `CloudinaryStorageProvider` from
environment configuration. This confirms the code path, not a deployed account's
behavior. Course code is unchanged in this branch.

Signed URLs in #146 only restrict access when Course also moves its assets to
the protected delivery type. Merely signing URLs for existing public assets does
not remove their unsigned public access. Moving old assets and preserving their
references/caches requires separate Course-owner work. This report does not claim
to have validated the current diff or implementation of #146.

## Verification

- Node 22.23.3 on Windows; existing local dependencies, no installation.
- Library: `npm run build`, `npm run typecheck`, `npm test`.
  All passed: 4 test files, 47 tests.
- New mock SDK/fetch tests exercise legacy image/raw/chunked-video paths,
  UUID keys, overwrite defaults/opt-in, optional delivery types on all operations,
  expiring signing, validation, errors, streamed size caps, cancellation and
  header/body timeouts. Offline tests also check real SDK 2.7.0 URL construction
  with synthetic credentials without making network requests.
- Tenant: `npm run test:unit` includes a build; 8 tests passed. Its dependency
  junction resolves to this shared library's rebuilt output.
- Course: `npm run build` and `npm test -- --runInBand`; 2 suites, 74 tests passed.
  Its dependency junction also resolves to this shared library's rebuilt output.
- Tenant PostgreSQL integration test could not run: the existing `tenant_db`
  has neither `users` nor `organizations` in `public` (catalog checked read-only).
  No database was created, migrated or altered. Service builds and unit tests,
  together with storage regressions, are the alternative compatibility checks
  for this library-only change.
- No Docker build/start/down, npm install or Prisma migration was run.

## Limits of initial offline verification

Mock and offline SDK tests do not prove remote access enforcement. Before the live
run below, a separately approved test-account check was needed for: authenticated upload; unsigned
original/derived denial; authorized download before expiry and denial after
expiry; exact image-byte/hash preservation; private/authenticated deletion;
raw download format conventions; and actual account settings, folder mode and
PDF restrictions. Raw keys retain the extension; the library also accepts an
empty format to omit that SDK parameter. The live run below verifies that convention
for the generated PDF only.

No expiry or privacy guarantee is claimed for a running account based solely
on offline tests. A live smoke test requires Hào's approval and test-account
credentials supplied through environment variables. No request for production
credentials is needed.

## Live smoke test 24/10/2026

One approved live run of the built library at `cf948f2` completed on 24/10/2026,
17:34:58–17:36:16 (UTC+07:00). No retries, package installation, library/service
edits or real images were used. The temporary script and result file remain
outside the repository. Only the three approved Cloudinary environment variables
were loaded; their values, cloud name, full URLs and signed query strings were
not printed or written to the results/report.

The script generated a 3,172-byte PNG and a one-page 603-byte PDF. Uploads used
random keys under `learnup-smoke/20261024T103458335Z-42c30a81/` with
`overwrite=false`. C1/C7 used `authenticated`; C8 omitted the delivery option to
exercise the legacy public default. C7 used `resourceType: raw`, matching the
Course Reading PDF upload at
[`courses.service.ts:1552`](../../services/course-service/src/modules/courses/courses.service.ts#L1552).
Metadata recorded for C1: resource type `image`, delivery type `authenticated`,
format `png`, returned size 3,172 bytes (equal to the original size).

Times below are UTC+07:00 on 24/10/2026. A dash means no HTTP status was exposed
by the library helper. C7/C9 are informational and do not affect acceptance.

| Case | Time | Expected | Actual (HTTP status) | Pass |
| --- | --- | --- | --- | --- |
| C1 | 17:34:59.920 | Protected PNG upload succeeds | SDK upload completed; image/authenticated/png, 3,172 bytes; HTTP not exposed | Yes |
| C2 | 17:35:00.977 | Unsigned protected and public locators denied | Protected **401**; public **404** | Yes |
| C3 | 17:35:01.977 | Signed download 200; original SHA-256 matches | **200**; SHA-256 matches; expiresAt **17:36:00**, UNIX seconds **1792838160** | Yes |
| C4 | 17:36:06.499 | Same URL denied after expiresAt + 5 seconds | **401**, checked 6.499 seconds after expiry | Yes |
| C5 | 17:36:07.830 | One altered signature character denied | **401**, using a newly signed URL still within its lifetime | Yes |
| C6 | 17:36:08.887 | Bounded read hash matches; undersized limit throws StorageProviderError | HTTP —; hash matches at maxSizeBytes 4,196; maxSizeBytes 3,171 raises **StorageProviderError** | Yes; timeout skipped |
| C7 | 17:36:10.811 | Record PDF behavior, informational | **200**; resource type **raw**, authenticated, 603 bytes; original SHA-256 matches; empty format accepted | Informational |
| C8 | 17:36:12.448 | Legacy default public upload remains publicly readable | **200**, image/upload | Yes |
| C9 | 17:35:03.074 | Record Range behavior, informational | **206**; Content-Range `bytes 0-99/3172`; Accept-Ranges `bytes`; Content-Length `100`; response 100 bytes; host `api.cloudinary.com` | Informational |

C9 ran while a newly signed C1 PNG URL was still valid, before waiting for C4.
The request header was `Range: bytes=0-99`. This demonstrates range delivery for
this PNG through `private_download_url`; it does not establish video seeking,
container/index behavior or player compatibility for #146. Those require a
separate video test. C7 demonstrates the generated raw PDF can be retrieved with
this API; it does not make existing public Course material protected.

C6 used `timeoutMs: 10000` for its live reads. Deliberately forcing a live network
timeout was skipped to avoid a nondeterministic result or complex network
simulation. Header/body timeout behavior remains covered by the offline tests.
This skipped timeout exercise was explicitly permitted and does not alter the
acceptance result. Delivery type `private` was not exercised in this run.

Cleanup ran in `finally`, deleting all created assets with the library's new
delete option and their exact resource/delivery types. Each subsequent request
used a fresh signed API URL to avoid conflating deletion with expiry.

| Resource type | Delivery type | Created | Deleted successfully | Fresh signed URL after delete | Admin prefix check |
| --- | --- | --- | --- | --- | --- |
| image | authenticated | 1 | 1 | **404** | **0 remaining**, 17:36:15.616 |
| raw | authenticated | 1 | 1 | **404** | **0 remaining**, 17:36:15.923 |
| image | upload | 1 | 1 | **404** | **0 remaining**, 17:36:16.234 |

Total: **3 created, 3 deleted**. All three Admin API queries returned empty
resource lists without a next-page cursor for the run prefix. No cleanup failed.
All required cases C1–C6 and C8 passed, with the permitted live timeout skip.
These observations verify this run only, not all account settings, asset formats
or future changes. No code changes were made in response to the live run.

## S1 review follow-up verification, 24/10/2026

This section supersedes the original behavior notes where they describe protected
`getUrl`, void delete results or unspecific provider errors. Upload results now
include the SDK response delivery type. Callers must persist it beside the key
and pass it to delete/sign/read; omitting it still selects public `upload`, with
no discovery or retry against other types. Delete distinguishes `deleted` from
`not_found`. Both mean cleanup is complete only for the requested exact tuple.
The Tenant/Course fallback providers only change their delete return annotations.

`StorageProviderError.code` is `NOT_FOUND`, `TIMEOUT`, `TOO_LARGE` or `UNAVAILABLE`.
Reads map HTTP 404, elapsed deadlines and Content-Length/streamed size caps to
the first three respectively. Network errors, 401/403, 5xx and other read failures
are `UNAVAILABLE`. Upload/delete classify structured SDK 404, timeout and 413
errors; other failures are `UNAVAILABLE`. All provider paths use fixed messages
without SDK/network causes, response bodies or interpolated provider results.
Signing credentials use a JavaScript private field; JSON serialization and normal
and hidden-field inspection tests confirm the secret is absent.

Verification used Node 22.23.3 and `npm ci`, with unchanged lockfiles. The first
Tenant install failed because the local ts-common prepare hook could not find
`tsc`; rerunning with the already installed storage compiler on process PATH
succeeded. Course used the same process PATH. Its existing postinstall invokes
unsupported `prisma skills sync` and explicitly ignores that failure; npm ci
completed. Prisma clients were generated solely for compilation, using a synthetic
unused connection URL; no migration or database operation was performed.

- Storage: build, typecheck and all 4 test files passed, **71 tests**. The original
  regression coverage remains; protected getUrl assertions now require rejection.
  Added coverage checks every error code, SDK sanitization, stream/header limits
  and timeouts, exact delivery metadata, delete statuses and credential inspection.
- Tenant: build and all **8 unit tests** passed.
- Course: build and all **74 tests in 2 suites** passed.
- Both service dependency declarations use `file:../../libraries/ts-storage`.
  Realpath checks of each service's resolved module confirmed the rebuilt storage
  `dist/index.js` in the same S1 checkout, rather than another checkout or copy.
- Tenant database integration was not rerun. These are compile/unit/mocked checks,
  not a claim of deployed PostgreSQL integration.
- No dependency upgrades, lockfile edits, Docker operations or migrations occurred.
  npm reported existing dependency audit findings (storage 5, Tenant 10, Course 11);
  no audit fix was run.

### Live delete/read follow-up

The external smoke script loaded only CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY
and CLOUDINARY_API_SECRET from the approved .env. It kept URLs, credentials and
SDK errors out of logs/results and used random keys, overwrite=false and cleanup
in finally. Two initial runs stopped at a byte-equality assertion: a small 68-byte
PNG fixture was returned as 67 bytes. Both runs cleaned up successfully, with
zero remaining assets. These runs are failures, not acceptance evidence.

The fixture was replaced with a generated PNG with computed CRCs using the same
construction as the earlier live smoke. Byte-equality assertions were retained.
The successful run at **23:20:29–23:20:33 (UTC+07:00)** observed:

| Case | Actual | Result |
| --- | --- | --- |
| Upload | image/authenticated, delivery metadata returned | Passed |
| Delete without delivery type | `not_found`; authenticated asset still readable, exact 3,172 original bytes | Passed |
| Delete with authenticated | `deleted` | Passed |
| Repeat authenticated delete | `not_found` | Passed |
| Read after delete | Fresh signed request HTTP 404; readBytes code `NOT_FOUND`, no cause | Passed |
| Finally cleanup and Admin prefix check | `not_found`, zero remaining assets, no next cursor | Passed |

The script and sanitized results remain outside the repository. This verifies the
tested account/fixture only; it does not establish byte preservation for every
image input or deployed service behavior.

## Storage consumers and Assessment compile regression, 25/10/2026

The repository-wide import scan covered services, libraries and frontend at both
`origin/develop` (`634b24a`) and S1 (`e3e8b0b`). The direct consumers at these
snapshots are Tenant, Course and Assessment. No other service or library imports
the package. Achievement's stacked branches are separate from these two snapshots
and are not included in this comparison.

| Consumer | Import sites, relative to its service directory |
| --- | --- |
| Tenant | `src/infrastructure/storage/storage.provider.ts`, `src/modules/profile/profile.service.ts`, `src/modules/users/users.service.ts` |
| Course | `src/infrastructure/storage/storage.provider.ts`, `src/modules/courses/courses.service.ts` |
| Assessment | `src/infrastructure/storage/storage.provider.ts`, `src/modules/assessments/assignment-media.service.ts`, `src/modules/instructor-submissions/instructor-submissions.service.ts`, `src/modules/learner-submissions/learner-submissions.service.ts`, `test/unit/fixtures.ts`, `test/unit/assessments-service.unit-test.ts`, `test/unit/learner-submissions-service.unit-test.ts` |

Each consumer declares `file:../../libraries/ts-storage`. Verification used
isolated full-repository source archives for develop, S1 before the fix, and S1
with the Assessment fix. Every snapshot started without library dist outputs: ts-common and ts-storage
were built from that snapshot's source, then Prisma clients were generated from
each service's own schema. No old dist or incremental build cache was used.
Course's default configuration also follows test imports into Learning source;
the full snapshots include that source and its dependencies and freshly generated
Prisma client. No Learning source was changed. An initial reduced snapshot was
discarded because it omitted this transitive source; the table below reports only
the complete-repository runs.
Existing dependency directories were reused only after checking identical
lockfiles; snapshot-specific @learnup package links and realpath checks confirmed
each consumer resolved its own freshly built libraries. Consumer TypeScript was
5.9.3, Node was 22.23.3. No package install, dependency upgrade or lockfile change
was needed.

Commands for each consumer were `tsc --noEmit --incremental false --pretty false
-p tsconfig.build.json` and the same command with `-p tsconfig.json`.
The table counts compiler diagnostics, rather than affected files:

| Consumer | Configuration | develop | S1 before fix | S1 after fix |
| --- | --- | --- | --- | --- |
| Tenant | tsconfig.build.json | Pass | Pass | Pass |
| Tenant | tsconfig.json | Pass | Pass | Pass |
| Course | tsconfig.build.json | Pass | Pass | Pass |
| Course | tsconfig.json | 141 existing errors | 140 existing errors | Same 140 errors |
| Assessment | tsconfig.build.json | Pass | 2 new errors | Pass |
| Assessment | tsconfig.json | Pass | 6 new errors | Pass |

All 140 Course diagnostics on S1 were also present on develop. The one additional
develop diagnostic is TS2322 in
`src/modules/internal-courses/internal-courses.batch.service.spec.ts` (a Jest
return value is incompatible with the node:test callback type). The other Course
diagnostics concern test globals such as describe/it/expect/jest, cross-service
module/alias resolution and resulting type errors under Course's default config. The complete
Course diagnostic output is identical before and after the Assessment fix.
These baseline issues are not new storage regressions and are left unchanged;
Course's normal build and Jest checks pass below. No consumer outside Assessment
developed a new error from S1.

Assessment's build errors were TS2416/TS2322 because its unconfigured provider
still returned Promise<void> from delete. The default configuration also found
missing deliveryType in MemoryStorage's upload response, the same delete return
mismatch in MemoryStorage, and TS2345 at both fixture injection sites. The fix
aligns the fallback annotation with IStorageDeleteResult while retaining the same
rejection. MemoryStorage returns the selected delivery type (default upload) and
uses Map.delete's existence result to return deleted/not_found, preserving its
call history. Correcting that structural contract fixes both injection sites
without casts or changes to their callers. ts-storage source is unchanged.

### Consumer follow-up checks

- Assessment: normal build passed; the full unit entrypoint passed **181 tests**
  in 31 suites, including three new provider/fixture regressions. The first
  `npm run test:unit` attempt could not launch because the reused dependency tree
  lacked its ts-node executable shim. Running the identical entrypoint directly
  succeeded: `node node_modules/ts-node/dist/bin.js -r tsconfig-paths/register -P
  tsconfig.seed.json test/unit/index.ts`. No test or assertion was skipped.
- Storage: rebuilt, typecheck passed, all **71/71 tests** passed.
- Tenant: build and **8/8 unit tests** passed.
- Course: build and **74/74 tests in 2 Jest suites** passed.
- Assessment resolved both libraries to the rebuilt outputs in its own S1
  checkout. Source, lockfiles and library contracts were not changed for tooling.
- No Docker operation, database connection, migration or live Cloudinary call was
  needed. These checks do not claim deployed Assessment/PostgreSQL integration.

### Existing delete-result behavior deferred to Danh

`assignment-media.service.ts` still awaits delete in `discardPromptFile` and
`removeIfUnused`; `learner-submissions.service.ts` still awaits delete in
`removeFile`. These call sites currently ignore the returned status, including
`not_found`, and react only to thrown failures. Their implementation and business
behavior are unchanged by this fix. Danh must decide separately whether either
status requires different handling; this compatibility fix adds no such rule.
