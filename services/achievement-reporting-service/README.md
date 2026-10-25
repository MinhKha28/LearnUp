# achievement-reporting-service

NestJS + Prisma 7 service for LearnUP.

Database: `achievement_reporting_db`
Port: `8087`

Certificate persistence and the approved database-design differences are recorded
in [the issuance verification report](../../docs/architecture/achievement-certificate-issuance-verification.md).

## Automatic certificate issuance (PR1)

`CERTIFICATE_CONSUMER_ENABLED` defaults to `false` and controls both the Kafka
consumer and issuance worker. When enabled, the dedicated group
`achievement-reporting-certificate-v1` reads EnrollmentCompleted from
`learnup.learning.enrollment-events`, starting at earliest if no offset exists.
Receiving commits Pending plus receipt (or quarantine) before committing the
offset. HTTP and Cloudinary calls run after that transaction.

Configure the three `CLOUDINARY_*` variables through the environment. They are
only required when an actual logo is copied. Missing configuration never aborts
application construction; an attempted copy stays Pending. Certificates without
a logo can issue without contacting storage. Protected uploads use the shared
`@learnup/ts-storage` provider with authenticated delivery and no overwrite.
Keys are private per attempt; hashes, MIME and byte size are stored without URLs.

Directory calls send internal key and organization header, with no user context.
Users lookup also sends the matching organization ID in its body. The Tenant
certificate-profile and Course service-call contracts must be deployed by their
owners before HTTP issuance works fully. Their failures do not trigger fake data.
`CERTIFICATE_PROFILE_CLIENT_MODE=fake` and `CERTIFICATE_COURSE_CLIENT_MODE=fake`
require explicit `NODE_ENV=development` or `test`; production and missing
NODE_ENV reject those settings. Users lookup remains HTTP in application mode.
The runtime Docker image defaults to production.

Use `.env.example` for configuration names and placeholders. Do not log or
commit credentials, source logo URLs, signed URLs, score payloads or email.
Logo downloads require HTTPS, an exact allowlisted host and bounded reads.
PNG/JPEG/WebP magic bytes determine the stored MIME. A download 404 refreshes
the profile once before retrying. No signer configuration or public certificate
API is added in PR1; signer columns remain null.

## Verification

```powershell
npm run build
npm run test:unit
# Requires a non-production DATABASE_URL and NODE_ENV=test.
npm run test:integration
```

PostgreSQL tests create a random `ar1_test_*` schema, apply the checked-in SQL
there and remove it in finally. They never reset the baseline database or use
real Cloudinary. Node native Kafka is loaded asynchronously only when needed;
missing binding/broker causes a safe warning and reconnect attempt rather than
rejecting application startup. A native package import and Linux build must
still be verified; lazy import is not proof that deployment dependencies work.

The baseline migration was designed for an empty PostgreSQL 16 database.
Inspect the target catalog and obtain approval before running Prisma migrate.
Do not mark an existing database baselined without checking its contents.

From the repository root, after building, a synthetic measurement can be run with
`node perf/achievement/certificate-issuance.cjs` and a non-production DATABASE_URL.
It uses real PostgreSQL and fake directory/storage/Kafka transport, recording
technical issuance delay and counts rather than an HTTP SLA.
See [verification report](../../docs/architecture/achievement-certificate-issuance-verification.md).
