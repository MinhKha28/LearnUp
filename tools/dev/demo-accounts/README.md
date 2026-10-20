# Explicit development demo accounts

Standalone Node.js 22+ orchestration; never runs on application startup. Requires
Docker Compose, current LearnUP services, PostgreSQL and the disposable Mailpit
receiver. It does not edit service code, migrations or the frontend. Dependencies
are in `develop` (Identity changes merged in PR #123; PR #122 was closed).

## Current live-verification blocker

**Not ready for a complete provisioning run.** The real isolated test exposed an
Identity credential-provisioning defect: `AuthService.setCredentials()` defaults
the username to `user_` plus the first eight User-ID characters. Tenant generates
UUIDv7 IDs, so accounts created close together can receive the same username.
PostgreSQL then rejects credential creation with `users_username_key`; Tenant
returns HTTP 503 during invitation acceptance. No business-service fix or timing
workaround is included in this tool task.

The latest real run verified dry-run and the Organizer's registration, email
verification, mock payment and login. The first Instructor invitation was created
and received, but its activation failed: 2 Tenant accounts, 1 Identity credential,
1 pending account. The disposable environment was removed. Full 16-account
provisioning and real rerun/idempotency remain unverified. Resolve the Identity
username-generation contract in a separately authorized task before using the
provision command. The focused adapter tests are not evidence of live success.

## Important: Admin bootstrap is not available

The manifest contains 17 identities, but there is **no safe Tenant-owned Admin
bootstrap contract**. The retired Identity seeder and the legacy SQL/account
upsert seeds are deliberately not used. Default provisioning stops before account
writes if Admin is absent. `--allow-missing-admin` explicitly allows the 16
Organization accounts, reports Admin as blocked, and exits **2**, not 17/17 success.
A pre-existing canonical Active Admin can be verified if its supplied password
works and neither Tenant nor Identity assigns it an Organization. Creating that
Admin requires a separately reviewed Tenant-owner bootstrap contract.

## Isolated setup

Use **only** this directory's Compose file, not root Compose or a shared database.
All data is disposable tmpfs; stopping/restarting PostgreSQL destroys its data.
The tool refuses shared volumes, other accounts/Organizations, unrelated networks,
non-loopback published ports, fake auth, mock mail, mismatched service secrets and
database wiring. Identity/Notification/Tenant/PostgreSQL have no host ports.
Only Gateway and Mailpit join a dedicated ingress bridge for their loopback host
ports. Business services cannot reach an external SMTP server; Mailpit has no
configured relay, forwarding or webhook integration. Both networks are target-owned.

Set the following in process environment or an explicitly loaded **ignored** local
`.env.local` file. Never commit values. No default password is provided.

| Variable | Required value / purpose |
| --- | --- |
| `NODE_ENV` | `development` (or `test`) |
| `DEMO_TARGET` | Unique local lowercase target, e.g. `accounts-local`; not prod/stage/shared |
| `DEMO_CONFIRM_ISOLATED` | `learnup-demo-` followed by that exact target |
| `DEMO_GATEWAY_PORT` / `DEMO_GATEWAY_URL` | Selected free port / `http://127.0.0.1:<same-port>` |
| `DEMO_MAILPIT_PORT` / `DEMO_MAILPIT_URL` | Selected free port / `http://127.0.0.1:<same-port>` |
| `DEMO_FRONTEND_URL` | Trusted local frontend origin, with explicit port; need not be running for provisioning |
| `DEMO_DB_PASSWORD` | Random URL-safe secret, at least 32 characters; letters/digits/underscore/hyphen only |
| `DEMO_JWT_SECRET` | Independent private random signing secret, at least 32 bytes |
| `DEMO_INTERNAL_KEY` | Independent private random service credential, at least 32 bytes |
| `DEMO_OTP_SECRET` | Independent private random verification HMAC secret, at least 32 bytes |
| `DEMO_ACCOUNT_PASSWORD` | Explicit local-only password for new accounts, 12–72 UTF-8 bytes; also used to verify existing fixture logins |

Do not load root `.env` or use production credentials. If loading `.env.local`,
export its variables to the shell before Compose; Node alone supports
`node --env-file=tools/dev/demo-accounts/.env.local ...`. The script does not
automatically load any environment file. `SPRING_PROFILES_ACTIVE`, if set in the
invoking shell, must be `development` or `test`. Containers explicitly use
`development`, never Docker/production profiles.

From the repository root, after exporting those variables:

```sh
docker compose -f tools/dev/demo-accounts/compose.yml config --quiet
docker compose -f tools/dev/demo-accounts/compose.yml up -d --build
# Once Tenant is ready: its existing reference seed creates plans/settings only.
docker compose -f tools/dev/demo-accounts/compose.yml exec -T tenant-service npm run prisma:seed
node tools/dev/demo-accounts/demo-accounts.mjs --manifest
node tools/dev/demo-accounts/demo-accounts.mjs --dry-run
node tools/dev/demo-accounts/demo-accounts.mjs --provision --allow-missing-admin
node tools/dev/demo-accounts/demo-accounts.mjs --status
```

Wait for service discovery/migrations before invoking the tool. Dry-run performs
read-only Docker inspection, SELECT-only database snapshots, readiness GETs, a
public plan GET and SMTP health GET; it never logs in, registers, pays, invites or sends mail. Status
uses metadata only and does not claim that a password was verified. Exit codes:
**0** complete, **1** safety/workflow failure, **2** explicit missing-Admin limitation.

## Inventory

| Email | Role | Organization |
| --- | --- | --- |
| admin@demo.learnup.test | Admin | None (bootstrap blocked) |
| organizer.alpha@demo.learnup.test | Organizer | LearnUP Demo Alpha |
| instructor.alpha01@demo.learnup.test | Instructor | LearnUP Demo Alpha |
| instructor.alpha02@demo.learnup.test | Instructor | LearnUP Demo Alpha |
| learner.alpha01@demo.learnup.test | Learner | LearnUP Demo Alpha |
| learner.alpha02@demo.learnup.test | Learner | LearnUP Demo Alpha |
| learner.alpha03@demo.learnup.test | Learner | LearnUP Demo Alpha |
| learner.alpha04@demo.learnup.test | Learner | LearnUP Demo Alpha |
| learner.alpha05@demo.learnup.test | Learner | LearnUP Demo Alpha |
| organizer.beta@demo.learnup.test | Organizer | LearnUP Demo Beta |
| instructor.beta01@demo.learnup.test | Instructor | LearnUP Demo Beta |
| instructor.beta02@demo.learnup.test | Instructor | LearnUP Demo Beta |
| learner.beta01@demo.learnup.test | Learner | LearnUP Demo Beta |
| learner.beta02@demo.learnup.test | Learner | LearnUP Demo Beta |
| learner.beta03@demo.learnup.test | Learner | LearnUP Demo Beta |
| learner.beta04@demo.learnup.test | Learner | LearnUP Demo Beta |
| learner.beta05@demo.learnup.test | Learner | LearnUP Demo Beta |

## Contracts and repeat execution

All business writes go through Gateway with actual Organizer Bearer JWTs:

- `GET /api/v1/subscription-plans`: choose the cheapest offered eligible plan
  (at least 2 Instructors and 5 Learners); no quota bypass.
- `POST /api/v1/registrations`: Tenant creates canonical IDs and provisions
  Organizer credentials through its authenticated Identity client.
- Read the real registration email in Mailpit, then
  `GET /api/v1/registrations/:token` verifies email ownership and
  `POST /api/v1/registrations/payments` performs the existing mock payment.
- Organizer login, then `GET /api/v1/users/{instructors|learners}/seats` and
  `POST /api/v1/users/{instructors|learners}` create pending invitations.
- Read each invitation from Mailpit; `GET /api/v1/invitations/:token` checks its
  context; `POST /api/v1/invitations/accept` sets the password through Tenant's
  Identity client and activates the canonical account.
- For every active account: `/api/v1/auth/login`, `/api/v1/users/me`, signed JWT
  role/Organization checks, and logout of **only the tool-created refresh session**.

Read-only `psql` inside the inspected disposable PostgreSQL container compares
Tenant/Identity IDs, email, role, status, Organization and Subscription metadata.
It does not select password hashes, tokens or email bodies. This narrow database
read is needed because existing internal lookup requires known User IDs and an
Organization ID; there is no safe global email lookup API. No database writes are
performed by the tool. Passwords, mail links, tokens and upstream error bodies are
never printed or saved. Email links are parsed in memory against the trusted
frontend origin. Mailpit retains messages only in its disposable tmpfs database.

Reruns verify existing Active identities and their current supplied password;
they do not register/invite them again, reset passwords, rotate credentials,
reactivate accounts, replace IDs, change memberships or delete conflicts.
All existing fixtures are checked before new business writes. A changed password
causes a safe failure unless the invoking operator supplies that current password.
This version uses one explicitly supplied development password for the manifest.

Pending, deleted, disabled, mismatched or orphan accounts block further writes.
Partially completed runs report `pending` and `skipped` rows and stop; they never
retry POSTs, resend links or silently repair. Resolve partial states with the
Tenant owner using legitimate workflows; don't rerun legacy seed SQL. A local
exclusive per-container lock prevents concurrent tool invocations by the same
operator; stale locks fail closed. Do not run other account-management processes
against this disposable target concurrently.

## Tests and cleanup

```sh
node --test tools/dev/demo-accounts/demo-accounts.test.mjs
# Explicit opt-in: builds a new isolated stack, generates ephemeral secrets,
# verifies 16 accounts + missing Admin + SMTP + rerun, then cleans up only its project.
# PowerShell:
$env:LEARNUP_DEMO_INTEGRATION = 'true'
node --test tools/dev/demo-accounts/integration.test.mjs
```

The first suite uses stateful endpoint adapters and a real local HTTP server; it
is not real Tenant/Identity/PostgreSQL/SMTP verification. The opt-in test uses
the real services and never creates an Admin by bypassing ownership. Its temporary
containers, networks, data and project-specific image tags are removed afterward
(shared base images and build cache are retained). It deliberately
changes one disposable fixture password to verify preservation, then destroys
that test-only project. No external inbox or production infrastructure is tested.

To remove a manually created fixture stack, verify `DEMO_TARGET` first, then run
`docker compose -f tools/dev/demo-accounts/compose.yml down --volumes` with the same
environment. This destroys only that selected disposable project, not root
LearnUP containers or a shared developer database. Do not run broad Docker prune.
