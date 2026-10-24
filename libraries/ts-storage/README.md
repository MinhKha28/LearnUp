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
options and in the new third-argument overload of `getUrl`.

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
  deliveryType: "authenticated",
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

`getUrl` remains an unsigned locator, including when a delivery type is supplied;
it does not authorize access to protected assets. Use `getSignedUrl` or
`readBytes` for access. Signed URLs are bearer credentials until expiry: keep them
on the server for certificate assets, never log or persist them, and authorize
the application request before signing/reading. Store keys and integrity metadata
instead. Existing upload response URL fields remain for compatibility; protected
certificate flows must not expose them.

`readBytes` requires a positive timeout and byte limit, checks Content-Length and
the cumulative streamed size, cancels on failure and rejects redirects. Its timeout
covers response headers and body. New signing/read errors exclude SDK/network
causes and response bodies because they may contain sensitive URLs. Supply storage
credentials through service environment configuration; this library reads no
credential files. Raw keys retain their extension. Raw downloads also accept an
empty `format` to omit that SDK parameter; the raw format convention still needs
test-account verification.

See [verification and Cloudinary sources](../../docs/architecture/storage-private-delivery-verification.md).
