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
The deployed account has not been exercised.

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
synthetic isolated fixtures. No live Cloudinary request was made.

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

## Not yet verified with Cloudinary

Mock and offline SDK tests do not prove remote access enforcement. A separately
approved test-account check is still needed for: authenticated upload; unsigned
original/derived denial; authorized download before expiry and denial after
expiry; exact image-byte/hash preservation; private/authenticated deletion;
raw download format conventions; and actual account settings, folder mode and
PDF restrictions. Raw keys retain the extension; the library also accepts an
empty format to omit that SDK parameter. This convention has not been verified remotely.

No expiry or privacy guarantee is claimed for a running account based solely
on these tests. A live smoke test requires Hào's approval and test-account
credentials supplied through environment variables. No request for production
credentials is needed.
