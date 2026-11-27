# course-service

NestJS + Prisma 7 service for LearnUP.

Database: `course_db`
Port: `8083`

The Prisma schema follows `LearnUP_Database_Guide.docx`:
- organization_quota_locks
- course_chains
- courses
- modules
- lessons
- materials
- media_files
- content_reports (phase 2)
- platform_settings
- outbox_events

The previous demo Course/Curriculum CRUD was removed because it did not match the finalized database guide.

## Internal course batch (Issue #146, item 4)

`POST /api/v1/internal/courses/batch` supports background calls with the local
`@ServiceCall()` marker. Authentication requires only:

- `x-internal-key`: the configured `INTERNAL_SERVICE_KEY` (timing-safe comparison).
- `x-organization-id`: a valid UUID identifying the caller's organization.

User headers are optional and ignored for authentication on this method, so
Learning's existing calls with user headers remain compatible. `x-service-name`
is not an authentication or authorization input; it may only be used for logging.
Other methods retain their existing user authentication. Gateway does not expose
this internal route through its public course route.

Request body (unchanged): `{ "courseIds": ["<course-version-uuid>"] }`.
Supply 1–100 unique UUIDs. There is no `organizationId` body field; extra fields
are rejected with HTTP 400. The organization header always scopes the query.
IDs outside that organization and nonexistent IDs are omitted identically.
Results preserve request order and include Archived and Disabled versions;
there is no status or latest-version filter.

Success response (HTTP 200, unchanged):

```ts
{
  statusCode: 200;
  message: 'Courses fetched successfully';
  data: Array<{
    courseId: string;
    chainId: string;
    versionNumber: number;
    name: string;
    courseType: string;
    status: string;
    coverFileId: string | null;
  }>;
}
```

Errors use the standard `{ statusCode, timestamp, path, error }` envelope:

| Condition | HTTP | `error.code` |
| --- | --- | --- |
| Missing or invalid internal key | 401 | `INVALID_INTERNAL_KEY` |
| Missing or invalid organization UUID header | 400 | `ORGANIZATION_REQUIRED` |

Invalid bodies return HTTP 400 with the existing validation error shape.
Authentication checks the key before validating organization context.

Verification: `npm test -- --runInBand` runs unit tests. With `DATABASE_URL`
pointing to an existing non-production PostgreSQL course database with the current
schema, run `npm run test:e2e -- --runInBand --runTestsByPath test/service-call-batch.e2e-spec.ts`.
This HTTP integration suite uses the real Prisma/PostgreSQL query and isolated
random fixtures, removed after the suite; it does not run migrations.

Kafka topic creation and drift handling are owned by the [shared provisioner](../../infrastructure/kafka/README.md). Services wait and retry while topics are unavailable; they never provision them.

## Integration tests

Use disposable PostgreSQL databases with the current migrations applied. E2e needs
only PostgreSQL (no Kafka, Cloudinary credentials or other services). The separate
Learning check also needs Learning dependencies/generated client, a migrated
Learning database and a seeded Course database; both names must end in `_test`
and start with `learning_` / `course_`. It locks the seeded Private course, so
use fresh databases. Synthetic authentication and client defaults are supplied by
the test setup; never use production credentials. Run from course-service:

```sh
# Required: DATABASE_URL points to the migrated disposable Course database.
npm run test:e2e -- --runInBand

# Separately provision and migrate a dedicated relay test database.
# Never reuse DATABASE_URL for OUTBOX_TEST_DATABASE_URL.
export OUTBOX_TEST_DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/course_relay_test"
npm run test:db

# Separate terminal: use the same Course DATABASE_URL, seed it and start Course.
npm run prisma:seed
npm run build
node -r ts-node/register -r ./test/setup-env.ts dist/src/main.js

# Required for this command: DATABASE_URL (Learning), COURSE_DATABASE_URL (Course),
# COURSE_SERVICE_URL (the Course HTTP URL, e.g. http://127.0.0.1:3000).
npm run test:values:learning
```

OUTBOX_TEST_DATABASE_URL must select a dedicated test database: tick() publishes
claimable unpublished rows from every organization in that database through a fake
producer. Never copy or reuse DATABASE_URL as this value. The relay precondition
refuses foreign unpublished events before cleanup or publication.

The course integration CI job runs e2e plus relay, catalog duration, enrollment
lock and migration-value database suites, each against PostgreSQL only. It creates
and migrates a dedicated `course_relay_test` database in the same PostgreSQL
service and sets OUTBOX_TEST_DATABASE_URL only for the relay step. E2e, catalog
duration, enrollment lock and migration-value suites keep using the shared
`course_e2e_test` database through DATABASE_URL.
The catalog HTTP check needs a seeded running Course service and remains local.
The real Course-to-Learning check remains a local integration
check; it is separate from `test:e2e`.
