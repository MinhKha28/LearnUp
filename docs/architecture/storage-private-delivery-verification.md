# Shared storage protected delivery verification

Date: 2026-10-24. Branch: `feat/storage/private-delivery`.
Base: `origin/develop`, `87b5fe9`.

## Scope and decision

This change extends `libraries/ts-storage` only, plus this report. Tenant and
Course source, dependencies, defaults and deployment configuration are unchanged.
Achievement issuance has not started and requires Hào's acceptance of this branch.
Its future branch must start from this library branch.

For certificate logo/signature snapshots choose `authenticated`: the original
and derived assets require authorization. `private` alone does not protect
derived assets by default. This follows Cloudinary's
[access-control documentation](https://cloudinary.com/documentation/control_access_to_media#restrictive_delivery_types).
Folder separation does not supply authorization.

The additive delivery option uses Cloudinary values `upload` (public default),
`private`, and `authenticated`, as documented in the
[upload parameters](https://cloudinary.com/documentation/upload_parameters#delivery_types).
Existing calls omit `type` as before. Upload/delete options accept `deliveryType`;
the original two-argument `getUrl` remains available with its unchanged behavior,
and an overload accepts optional delivery settings. No existing service must
implement the new read capability.

The new `getSignedUrl` uses the SDK's `private_download_url`, with caller-supplied
future UNIX-seconds `expiresAt`, resource type, format and delivery type. This is
an API download URL rather than a CDN transformation signature. Cloudinary
documents its expiry, available delivery types and lack of CDN caching in
[time-limited access](https://cloudinary.com/documentation/control_access_to_media#providing_time_limited_access_to_private_media_assets)
and the [Upload API reference](https://cloudinary.com/documentation/image_upload_api_reference#private_download_url).
At initial offline verification, no Cloudinary account had been exercised.

`getUrl` returns an unsigned locator; choosing a protected type does not make
that locator readable. Signed URLs grant possession-based access until expiry,
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

The upload result still has its legacy URL fields. Achievement must store only
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
