# Cross-service E2E API journeys

Re-runnable API-level journeys against a real local cluster (no UI). Each run creates its own
data under a unique run prefix (`e2eYYMMDDhhmmss`), asserts business outcomes (status codes,
state read back through the API, Kafka event observed) and never deletes anything.

| ID | Journey | Services |
| :-- | :-- | :-- |
| J1 | Login through identity, authorised gateway call, unauthorised calls rejected | gateway, identity, tenant |
| J2 | Organizer creates learners, invitation email, accept, learner login | gateway, tenant, notification, identity |
| J3 | Organizer assigns a course, learner sees it, `EnrollmentAssigned` reaches Kafka | gateway, learning, tenant, course, kafka |
| J4 | Catalog, course introduction, self-enroll, My Enrollments | gateway, course, learning |
| J5 | Curriculum, video/reading progress, completion | gateway, learning, course |
| J6 | Assessment access follows enrollment status (L17) | gateway, assessment, learning |
| J7 | Certificate signer settings: ETag, If-Match save, 412/428 | gateway, achievement-reporting |
| J8 | Tenant isolation between organization A and B | gateway, tenant, course, learning, achievement-reporting |

## Start the cluster (Linux host, Docker, JDK 21, Node 22)

Windows: run everything (build, `cluster/start.sh`, `run.mjs`, `cleanup.mjs`) inside WSL2 with
Docker Desktop's WSL integration; Git Bash is not supported (no `lsof`, different `/tmp`).
`E2E_STATE_DIR` must be the same for the cluster scripts and the runner/cleanup, otherwise they
read different state (secrets, mailbox, run records).

Build once (no lockfile changes):

```bash
(cd libraries/java-common && mvn -B -DskipTests install)
for d in infrastructure/eureka-server gateway/api-gateway services/identity-service \
         services/notification-service services/audit-service; do (cd $d && mvn -B -DskipTests package); done
for d in libraries/ts-common libraries/ts-storage; do (cd $d && npm ci && npm run build); done
for s in tenant course learning assessment achievement-reporting; do
  (cd services/$s-service && npm ci && npx prisma generate && npm run build); done
tests/e2e/cluster/start.sh      # idempotent; tests/e2e/cluster/stop.sh stops host processes
```

`start.sh` runs postgres and kafka from the E2E-only `cluster/compose.e2e.yml` under the compose
project `learnup-e2e` (`cluster/compose.sh`; `E2E_COMPOSE_PROJECT` may only be changed to another
name ending in `-e2e`). Containers, volumes (`learnup-e2e_postgres_data`, `learnup-e2e_kafka_data`)
and the network (`learnup-e2e_default`) are separate from the developer's root `docker-compose.yml`
stack (project `learnup`). That stack uses the same host ports (5433, 9092), so `start.sh` refuses
to run while any of its containers is running; stop it yourself, E2E never stops or deletes it.
`stop.sh` kills whatever listens on the recorded service ports (8080-8093, 8761, 2525), so on a
shared machine make sure nothing else uses them. It starts every service from
the host builds, applies migrations, runs each service's own seed once, and starts a loopback
SMTP sink. It then provisions credentials for the two seeded Organizers through Identity's
authenticated internal channel. Everything it generates, including random secrets in
`cluster.env`, per-service env files, logs, the mailbox and run records, lives in
`$E2E_STATE_DIR` (default `/tmp/learnup-e2e`) and never in the repository.

Topology mirrors the production frontend build (compose builds every `VITE_*_BACKEND_URL` as
the gateway): every journey call goes through the gateway on `:8080`. Direct service calls are
used only for trust-boundary checks and for steps marked `diagnostic`, which bypass a missing
gateway route (GW-1) with gateway-equivalent headers to keep checking the rule behind it.

Fakes and non-default settings used:

| Setting | Why |
| :-- | :-- |
| smtp-sink on `127.0.0.1:2525`, `LEARNUP_MAIL_ENABLED=true` | Read OTP and invitation links; nothing leaves the host |
| Cloudinary variables empty | Storage stays unconfigured; no journey uploads files |
| learning `TENANT_CLIENT_MODE=fake` | Same as compose |
| learning `VIDEO_PLAYBACK_MODE=fixture`, `READING_ACCESS_MODE=fixture` | course-service playback/reading contract not built (CT-3) |
| achievement `CERTIFICATE_SIGNER_ACCESS_CLIENT_MODE=fake` | Tenant organization-access endpoint not built (CT-2) |
| achievement `CERTIFICATE_CLEANUP_ENABLED=false`, consumer off | No storage, no certificate issuance in scope |
| tenant `DEV_FAKE_AUTH=false`, `LEARNING_CLIENT_MODE=http`, `COURSE_CLIENT_MODE=http` | Real gateway identity and real calls |

## Run

```bash
node tests/e2e/run.mjs          # all journeys; or e.g. node tests/e2e/run.mjs J1 J7
```

Exit code 0 means every journey is `PASS` or `KNOWN-FAIL`. A `KNOWN-FAIL` step still asserts the
correct behaviour; it fails only because of a bug listed below. Fixing a bug turns that step into
`UNEXPECTED-PASS`; then remove the bug ID from `lib/known-bugs.mjs`. The run record
(`$E2E_STATE_DIR/runs/<runId>.json`) holds every created ID plus per-journey and per-route
latency (single-user, not a load test).

J2 waits up to about 65 s for a fresh UUIDv7 window before the first activation. This works
around ID-1 so that consecutive runs stay deterministic.

## Cleanup (explicit, never run by the suite)

```bash
node tests/e2e/cleanup.mjs --run <runId>        # dry run
node tests/e2e/cleanup.mjs --run <runId> --yes  # or --all
```

Uses business APIs only: Optional enrollments are withdrawn and InProgress assignments are
exempted. Accounts, credentials, Kafka events and signer history have no deletion API and are
kept. A full reset of the E2E infrastructure is a separate explicit command:

```bash
tests/e2e/cluster/reset.sh        # dry run: lists the learnup-e2e volumes it would remove
tests/e2e/cluster/reset.sh --yes  # stop.sh, then docker compose -p learnup-e2e down -v
```

It only removes volumes that compose resolves for the E2E project and that carry the label
`com.docker.compose.project=learnup-e2e`; anything else aborts without deleting. Never run
`docker compose down -v` from the repository root for E2E: that is the dev stack and removes
its volumes. `$E2E_STATE_DIR` (secrets, mailbox, run records) is kept; delete it by hand if wanted.

## Known failures

`$ORG` is an Organizer access token, `$KEY` the `INTERNAL_SERVICE_KEY` from `cluster.env`.

- **ID-1 (identity-service).** Tenant does not send a username, so Identity defaults it to
  `user_` plus the first 8 hex digits of the user ID. Tenant IDs are UUIDv7, which share those
  digits for about 65 s. The second account created in that window cannot activate: accept
  returns 503 `IDENTITY_UNAVAILABLE`, Identity logs 500 `users_username_key`, and the account
  stays Pending.
  ```bash
  for n in 1 2; do curl -s -X POST localhost:8080/api/v1/users/learners -H "Authorization: Bearer $ORG" \
    -H 'content-type: application/json' -d "{\"fullName\":\"Repro $n\",\"email\":\"repro$n-$RANDOM@e2e.learnup.test\"}"; done
  # take both /activate/<token> links from $E2E_STATE_DIR/mailbox, then:
  curl -X POST localhost:8080/api/v1/invitations/accept -H 'content-type: application/json' -d '{"token":"<t1>","password":"Repro-Pw1!"}'  # 200
  curl -X POST localhost:8080/api/v1/invitations/accept -H 'content-type: application/json' -d '{"token":"<t2>","password":"Repro-Pw1!"}'  # 503
  ```
- **GW-1 (api-gateway).** There is no route for `/api/v1/assignments/**`, which the frontend
  organizer assignment pages call through the gateway.
  `curl -i localhost:8080/api/v1/assignments -H "Authorization: Bearer $ORG"` returns 404
  `RESOURCE_NOT_FOUND`.
- **CT-1 (assessment-service, contract with learning-service).** The `completion-snapshot`
  endpoint is missing, so no enrollment ever reaches Completed. The learning fake cannot stand in
  for it, because its default snapshot is not eligible.
  `curl -i -H "x-internal-key: $KEY" localhost:8086/api/v1/internal/learners/<learnerId>/courses/<courseId>/completion-snapshot`
  returns 404.

Contract gaps worked around with documented fakes (not counted as failures):

- **CT-2 (tenant-service).** `GET /api/v1/internal/organizations/:id/access` is missing. In http
  mode (the compose default), signer save returns 503 `TENANT_UNAVAILABLE`.
- **CT-3 (course-service).** No playback or reading contract exists. In course mode (the compose
  default), `GET /api/v1/enrollments/:id/materials/:mid/playback` returns 503
  `PLAYBACK_UNAVAILABLE`, and `reading-access` returns 503.

Not covered yet: quiz attempts and assignment submissions. The assessment seed uses
`0199a000-…` course IDs, which do not match the course seed (`01900000-…`), so no assessment
exists for any course in this cluster. A learner of organization B is not exercised either,
because creating one costs another UUIDv7 window (ID-1).
