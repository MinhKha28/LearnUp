# @learnup/ts-storage

Shared framework-neutral storage library for LearnUP TypeScript services.

## Responsibilities

- Storage provider abstraction
- Cloudinary upload/delete
- File MIME validation
- File size validation
- Provider response normalization
- Optional private/authenticated delivery and bounded server-side reads

## Non-responsibilities

This package does not contain:

- NestJS controllers
- Prisma logic
- Database logic
- Course business logic
- Assessment business logic
- Organization quota rules

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
```

## Delivery and server reads

Existing upload/delete calls and `getUrl(key, resourceType)` retain public
Cloudinary `upload` delivery. `overwrite` still defaults to `false`; omitting
`publicId` still generates a UUID. `deliveryType` is optional on upload/delete
options and in the third-argument overload of `getUrl`. `getUrl` accepts only
omitted or `upload` delivery; protected types throw and require `getSignedUrl`.

Upload results include `deliveryType`, taken from the provider response. Store it
beside `storageKey` and `resourceType`, plus the original `format` when signing.
Pass the stored delivery type to `delete` and `getSignedUrl` (or `readBytes`).
Omitting it still means public `upload`; the provider never discovers or retries
other delivery types. Deleting an authenticated asset without that metadata may
return `{ status: 'not_found' }` while the authenticated asset still exists.
Delete returns `{ status: 'deleted' }` or `{ status: 'not_found' }`; both are
terminal cleanup outcomes for the exact key/resource/delivery tuple requested.
Other provider failures throw `StorageProviderError`.

Choose `authenticated` for certificate images: Cloudinary protects both originals
and derived assets. `private` alone protects originals but may expose derived
assets. A folder name is an organizational prefix, not an access control boundary.

```ts
const stored = await provider.upload(file, {
  folder: "learnup/achievement/logos",
  resourceType: "image",
  deliveryType: "authenticated",
  overwrite: false,
});
const bytes = await provider.readBytes(stored.storageKey, {
  resourceType: "image",
  deliveryType: stored.deliveryType,
  format: stored.format!, // validate/retain the original format at upload
  expiresAt: Math.floor(Date.now() / 1000) + 60,
  timeoutMs: 5000,
  maxSizeBytes: 2 * 1024 * 1024,
});
```

`CloudinaryStorageProvider` implements the additive `IReadableStorageProvider`
capability. Existing implementations of `IStorageProvider` need no new methods.
`getSignedUrl(key, options)` generates an Upload API `private_download_url` with
an explicitly required future `expiresAt` in UNIX seconds. This differs from a
CDN `sign_url` signature, which by itself does not provide an expiry.

`getUrl` returns an unsigned URL for public `upload` assets. Use `getSignedUrl` or
`readBytes` for protected assets. Signed URLs are bearer credentials until expiry: keep them
on the server for certificate assets, never log or persist them, and authorize
the application request before signing/reading. Store keys and integrity metadata
instead. Upload response `url` and `secureUrl` remain required strings for legacy
public consumers. For private/authenticated assets they are only provider
locators, not usable authorized download URLs: do not persist, log or return them
outside the service. Keep keys and delivery metadata instead.

`readBytes` requires a positive timeout and byte limit, checks Content-Length and
the cumulative streamed size, cancels on failure and rejects redirects. Its timeout
covers response headers and body. `StorageProviderError.code` is one of:

| Code | Meaning |
| --- | --- |
| `NOT_FOUND` | HTTP/SDK 404 |
| `TIMEOUT` | Read deadline, SDK timeout or HTTP 408 |
| `TOO_LARGE` | Read Content-Length/stream cap or SDK HTTP 413 |
| `UNAVAILABLE` | Network, 401/403, 5xx and other provider/validation failures |

All upload/delete/signing/read provider errors exclude SDK/network causes,
response bodies and dynamic provider results because they may contain sensitive
URLs or credentials. Messages are fixed and safe to log; no underlying cause is
attached. Signing credentials are held in a JavaScript private field and are
omitted by `JSON.stringify` and `util.inspect`. Supply storage
credentials through service environment configuration; this library reads no
credential files. Raw keys retain their extension. Raw downloads also accept an
empty `format` to omit that SDK parameter; the raw format convention still needs
test-account verification.

See [verification and Cloudinary sources](../../docs/architecture/storage-private-delivery-verification.md).
