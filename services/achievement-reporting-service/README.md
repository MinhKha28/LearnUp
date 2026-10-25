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

Use `.env.example` for configuration names and development-only placeholders.
The Tenant service listens on port 8084; set `TENANT_SERVICE_URL` accordingly.
In production, or when `NODE_ENV` is missing, startup requires a nonblank
`INTERNAL_SERVICE_KEY` and a PostgreSQL `DATABASE_URL` containing an explicit
username and password. Invalid/missing credentials stop startup before database
connections or workers start; diagnostics never include credential values.
Only explicit `NODE_ENV=development` or `test` skips this credential guard.
Compose requires explicit `DB_USERNAME`, `DB_PASSWORD` and `INTERNAL_SERVICE_KEY`.
Do not use the development example credentials for deployment.

Compose forwards signer access mode and all cleanup settings from the environment.
Defaults remain HTTP access, cleanup enabled, delay 600000 ms, poll 1000 ms,
cleanup lease 120000 ms and backlog warning 3600 seconds. Startup rejects
cleanup delay ≤ issuance lease + storage timeout and cleanup lease ≤ storage timeout.

Use the environment to supply production credentials. Do not log or
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
