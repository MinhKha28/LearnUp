# Tenant access HTTP adapter verification (D-050)

Date: 2026-10-29 (Asia/Saigon). Baseline: `f4d44b5f72e3c6dd47536dd06435746d771ae619`.
Branch: `feat/learning/tenant-access-http-adapter`.

## Result

Learning reads organization access over Tenant's internal HTTP endpoint, sending only
`x-internal-key` and `x-organization-id`. The adapter validates the response, compares
UUIDs case-insensitively, converts the read-only ISO timestamp to a Date, and uses
an uncached request for every write gate. Recognized organization-not-found 404s log
the organization ID and block writes with 403; dependency and contract errors return
503. Organization status is checked before the existing subscription rules.

Assignment create, extend and exempt use `ORGANIZATION_NOT_ACTIVE` and the approved
Vietnamese message; optional enrollment retains `FORBIDDEN`. Grace handling is
unchanged. The assignment UI maps the new code to the same approved message.
Root Compose and Learning's environment example default to HTTP; UC25.3 perf
explicitly selects fake mode and rejects a running Learning container in HTTP mode.

`OrganizationTimezoneService`, Tenant and Course source, database migrations,
shared-library source and all lockfiles are unchanged. The existing Tenant account
seed creates ABC (`…a001`) Active with a current Active subscription (`…a301`).
Learning's existing demo seed ran successfully in HTTP mode; its separate assessment
fixture prerequisite was supplied for Course Y.

## Tests and checks

Both baseline and changed suites used the same locked dependencies. The integration
baseline was executed from an untouched tracked-file snapshot of `f4d44b5`, with its
own disposable database. Each integration run cleaned up its disposable database.

| Suite | Baseline passed | Changed passed | Skipped before / after | Failures on completed runs |
| --- | ---: | ---: | ---: | ---: |
| Learning unit | 280 | 355 | 0 / 0 | 0 |
| Learning integration | 233 | 239 | 5 / 5 | 0 |
| Frontend | 454 | 456 | 57 / 57 | 0 |

Passed: Learning `npm run build`, `tsc -p tsconfig.build.json --noEmit`, default
`tsc --noEmit`, frontend `tsc -b`, frontend lint on both changed files, and strict
Learning lint on all changed production files and both new test files. Root Compose
configuration validated in default HTTP and explicit fake modes. The perf runner
passed PowerShell syntax parsing. Git whitespace checks passed.

Lint was run on every changed Learning TypeScript file. Legacy tests already had
133 errors and 56 warnings at baseline; the changed files have 131 errors and 56
warnings, with zero added diagnostics when comparing per-file rule, severity and
message counts. This comparison and clean production/new-test lint are the reliable
alternative to an entirely clean legacy-test lint run; no rules or assertions were
weakened.

The first integration attempt hit its unchanged 109-second suite deadline while
Docker builds and frontend checks competed for resources. The subsequent full run
passed within that deadline (approximately 33 seconds); no deadline was raised.

## Real check transcript

Own Compose project: `learnup-l8-access`, PostgreSQL 16, real Tenant, Course and
Learning images built from this worktree. Only loopback ports were published:
PostgreSQL 55438, Tenant 58048 and Learning 58058. Course had no host port. Test-only
configuration and logs are ignored, and no deployment credentials were used.

| Step | Observed result |
| --- | --- |
| Start Learning with Tenant absent; assignment-list read | 200 |
| Write while Tenant is absent at startup | 503 `SERVICE_UNAVAILABLE` |
| Tenant seeded ABC organization / current subscription | Active / Active |
| Tenant access using mixed-case path/header UUIDs, no user headers | 200 |
| UC24.2 assign, ABC Active | 201 |
| Set only ABC organization status to Suspended, leave subscription Active; assign | 403 `ORGANIZATION_NOT_ACTIVE` |
| Assignment-list read while ABC is Suspended | 200 |
| Restore ABC Active | Successful isolated Tenant DB update |
| Authenticated synthetic caller organization absent from Tenant; assign | 403 `ORGANIZATION_NOT_ACTIVE` |
| Missing-organization error log | Included caller organization ID |
| Stop Tenant; assign | 503 `SERVICE_UNAVAILABLE` |
| Assignment-list read with Tenant stopped | 200 |

The stopped-Tenant read contained existing seeded/assigned records. Containers were
stopped after verification; the isolated PostgreSQL volume was retained.

Initial seed invocations exposed runtime-image omissions of seed prerequisites.
Existing Tenant/Course source and Course TypeScript configuration were mounted
read-only in the ignored isolated Compose file. Learning's platform-settings seed
used the installed host toolchain against the isolated database. No Dockerfile or
Tenant/Course source changes were needed.

## Limits

The five unchanged integration skips cover the optional outbox/Kafka checks. The
57 unchanged frontend skips are browser-oriented dev tests. No full E2E browser
journey or performance benchmark was run. The real infrastructure check covered
assignment creation and read resilience; extension, exemption and optional-enrollment
status/error behavior was verified by service/unit and PostgreSQL integration tests.

## Changed files

- `docker-compose.yml`
- `docs/project-status/DOCKER_DEPLOYMENT_REPORT.md`
- `frontend/src/utils/assignments.view.test.ts`
- `frontend/src/utils/assignments.view.ts`
- `perf/learning/README.md`
- `perf/learning/run.ps1`
- `services/learning-service/.env.example`
- `services/learning-service/docs/tenant-access-http-verification.md`
- `services/learning-service/src/infrastructure/clients/tenant/create-tenant-client.ts`
- `services/learning-service/src/infrastructure/clients/tenant/fake-tenant.client.ts`
- `services/learning-service/src/infrastructure/clients/tenant/tenant-access.http.ts`
- `services/learning-service/src/infrastructure/clients/tenant/tenant.client.ts`
- `services/learning-service/src/modules/assignments/assignment-changes.service.ts`
- `services/learning-service/src/modules/assignments/assignments.service.ts`
- `services/learning-service/src/modules/enrollments/enrollments.service.ts`
- `services/learning-service/test/integration/assignment-changes.integration-test.ts`
- `services/learning-service/test/integration/assignment-reads.integration-test.ts`
- `services/learning-service/test/integration/assignments.integration-test.ts`
- `services/learning-service/test/unit/assignment-reads.unit-test.ts`
- `services/learning-service/test/unit/curriculum-service.unit-test.ts`
- `services/learning-service/test/unit/enrollments-service.unit-test.ts`
- `services/learning-service/test/unit/index.ts`
- `services/learning-service/test/unit/my-enrollments.unit-test.ts`
- `services/learning-service/test/unit/tenant-access-services.unit-test.ts`
- `services/learning-service/test/unit/tenant-access.unit-test.ts`
- `services/learning-service/test/unit/tenant-client.unit-test.ts`
- `tests/e2e/README.md`
