# BR-31 credential provisioning integration

## Contract assumptions recorded before implementation

- Base: `a891584545426d72fd59692c06a71d47823ca882`, including `712eacd`.
  Scope is Identity source, tests and integration documentation only.
- `GET /api/v1/internal/users/{userId}/existence` uses the existing private
  `X-Internal-Key`. The specified HTTP contract is exactly status 200 with a JSON
  object containing a boolean `exists`. It is **not** the sign-in-access envelope.
  Tenant must confirm whether its global response interceptor will be bypassed.
- `exists=true` includes disabled/pending accounts and accounts in suspended
  Organizations. Only committed deletion or absence means `exists=false`.
  Sign-in access is not evidence of deletion.
- The existence lookup must be a bounded, nonlocking committed read on a separate
  available connection. It must neither acquire the registration email advisory
  lock nor call Identity. Otherwise registration -> Identity -> existence can
  deadlock across services even though neither database detects the full cycle.
- Tenant must serialize **all** competing email lifecycle operations through its
  canonical commit, including cancellation/deletion and invitation-related
  claims. Identity cannot distinguish an uncommitted Tenant user from an orphan
  using a boolean existence response. Identity locks do not span Tenant commits.
- Tenant must also make the old deletion visible before the existence callback.
  If a future UC02 transaction soft-deletes the old owner and calls Identity
  before committing, a separate nonlocking existence read still sees the old
  nondeleted owner and correctly returns true. Waiting for that transaction's
  commit instead creates a circular wait. The current `expireRegistration()`
  commits its own transaction before provisioning; the proposed lock/transaction
  restructuring must explicitly preserve safe visibility and serialization.
- The existing schema requires `users.email NOT NULL UNIQUE`. A safe retained-user
  handoff needs an explicit released-email representation. A forward migration
  allowing NULL while preserving the unique constraint has been proposed; this
  part remains blocked pending the representation decision. No fabricated email,
  account deletion or historical migration rewrite is acceptable.
- Tenant currently converts every non-successful Identity response to 503 and its
  fetch has no explicit timeout. The Tenant owner must confirm conflict handling
  and bound its outbound request/transaction/pool waits. Identity must retain its
  own 409/503 contract without changing Tenant-owned code.

No complete Tenant/Identity BR-31 flow has been verified or deployed. The real
endpoint and registration locks are being implemented by the Tenant owner.

## Completed client scope and remaining blocker

`TenantAccessClient.exists(UUID)` implements the literal HTTP contract above. It
uses the configured Tenant URL and the existing internal key, the existing
three-second connect/read timeouts, no application retries, and no redirects.
Only an HTTP 200 JSON object with exactly one boolean `exists` is accepted. Empty,
coerced, duplicate, trailing, oversized or enveloped responses fail closed. Error
bodies and parsing exceptions are not retained or logged. The existing
`TenantUnavailableException` maps to HTTP 503 / `TENANT_UNAVAILABLE` if propagated
through the existing Identity advice. Sign-in eligibility is still a separate
lookup with its existing response and behavior.

**This client is not yet connected to credential provisioning.** The existing
`AuthService.setCredentials()` and destructive `releaseEmailFromOtherUser()` have
not been changed while the schema decision is pending. This is a completed client
subtask, not an integration-ready provisioning fix. No new 409 `EMAIL_IN_USE`
behavior or safe `exists=false` handoff has been implemented. No migration, public
route, request field or metadata-update behavior has changed.

The blocker is concrete: retaining the old row with its old email prevents the
new row from acquiring that email under the current unique constraint. Setting
the old email to NULL fails the current NOT NULL constraint. Deleting the old row
cascades into refresh/recovery records. A fabricated replacement address would
invent a new account representation without an agreed contract. The proposed
forward nullable-email migration would retain uniqueness for every claimed email
and require no account deletion, but its semantics need a decision before use.

## Provisioning design to complete after the decision

Keep `POST /api/internal/credentials` and its current DTO/success envelope. Resolve
the previous owner from Identity storage, never from caller-supplied evidence.
Acquire existing requester/owner rows in deterministic ID order with bounded
pessimistic locks before checking Tenant, then revalidate ownership. The database
unique email and primary-key constraints must arbitrate absent-row races; flush
and translate constraint/lock conflicts inside the transaction without returning
SQL details. No check-then-delete path is acceptable.

Under the chosen representation, `exists=true` must yield 409 / `EMAIL_IN_USE`;
`exists=false` must atomically release only the old email claim and provision the
requester's canonical ID. Tenant failure must yield 503 without writes. Any
subsequent insert, constraint, token cleanup or commit failure must roll back the
release as well as the new claim. The old ID, username, password hash, role,
Organization, enabled state, creation time, refresh sessions and recovery tokens
must remain attached to the old ID. The old email and update timestamp are the
only intended old-row changes. The requester keeps established password
replacement and session/recovery-token revocation semantics. Same-ID retries must
not perform a cross-user existence check.

Identity database locks end before Tenant's surrounding transaction commits.
They cannot prove that an absent Tenant ID will never commit later. Tenant must
therefore confirm email lifecycle serialization through the canonical commit,
including invitation acceptance and retries with the same canonical ID. Never
infer complete cross-service safety from Identity-only concurrency tests. The
current invitation flow provisions credentials before consuming its invitation
and activating the same Tenant ID; it must retain that ID on retries. Identity
does not activate or create the Tenant account. The metadata-only PUT must remain
existing-ID-only and must never be used for provisioning.

## Verification and deferred real integration steps

Run from `services/identity-service` with Java 21 and the owner's Maven cache:

```powershell
mvn --offline '-Dmaven.repo.local=C:/Users/Nguyen Hoang Dat/.m2/repository' test
./src/test/scripts/Test-PasswordResetPostgres.ps1 -AllTests -MavenGoals clean,verify -Offline -MavenRepository 'C:/Users/Nguyen Hoang Dat/.m2/repository'
```

The second command requires an already-running Docker engine and a cached
`postgres:16-alpine`; it creates and stops only its uniquely labelled disposable
database. Do not start the demo-account stack or aim test environment variables at
persistent `identity_db`/`tenant_db`. These suites mock Tenant and do not establish
real endpoint integration. `TenantAccessClientTest` independently uses a loopback
HTTP stub and checks failure/response parsing and secret-safe diagnostics.

Local results for the completed client subtask (2026-10-27, Java 21):

- Client HTTP contract: 36 passed, no failures or skips.
- Full default suite: 493 discovered, 435 passed, 58 skipped, no failures.
- Full `clean verify` with PostgreSQL gates enabled: 524 discovered, 521 passed,
  three optional recovery-email end-to-end tests skipped, no failures. H2 suites
  and migrated PostgreSQL suites both ran. Docker was unavailable, so a separate
  native PostgreSQL 16.15 cluster used a random loopback port, a generated
  disposable password and the existing guarded `identity_reset_test` profile.
  The owned cluster was stopped afterward; persistent databases were never used.

These results cover the existing provisioning/metadata/password-reset/refresh
regressions and the new HTTP client. They do not cover an implemented BR-31
ownership transition, because that implementation is blocked as described above.

After the schema decision, provisioning implementation and Tenant endpoint/locks
are complete, use **new disposable Identity and Tenant databases** and synthetic
accounts for these acceptance steps:

1. Configure both services with independently generated disposable secrets through
   their process environments. Keep the normal private Identity network boundary.
   Use `TENANT_SERVICE_URL`/`IDENTITY_SERVICE_URL` to address these test instances.
2. Call authenticated `GET /api/v1/internal/users/{id}/existence` for committed
   pending, active, disabled, soft-deleted and nonexistent test IDs. Assert exactly
   `200 {"exists":true}` for the first three and `200 {"exists":false}` for the
   last two. Suspend an Organization and confirm its nondeleted user remains true.
   Call without/with an invalid key and require denial. Confirm the raw JSON
   contract, including the global-interceptor decision, before proceeding.
3. Register with UC02 using a fresh synthetic email, then repeat the same canonical
   credential request at `POST /api/internal/credentials`. Expect 200 and one
   Identity user. Record database rows rather than emitting credential values.
4. Try a different ID against a nondeleted previous owner: require 409 /
   `EMAIL_IN_USE` from Identity and unchanged owner/token rows. Separately verify
   Tenant's intended translation of that Identity response.
5. Commit Tenant deletion/cancellation, register again with the same email, and
   require a new ID plus the retained old Identity row and its original sessions.
   Repeat with an Identity orphan whose ID was never committed in Tenant.
6. Hold the first UC02 transaction before its Tenant commit and submit a second
   same-email registration plus an invitation claim. Release the first and assert
   the agreed single canonical email owner, bounded responses and no account
   deletion. Repeat concurrent handoffs and same-ID retries. Observe pool use and
   ensure existence reads never wait on the caller's advisory/row locks.
7. Cut only the disposable existence channel or return 401/403/5xx, invalid JSON
   and delayed responses through a test proxy. Require 503 from Identity and exact
   database rollback; restore the channel and retry with the same requester ID.
8. Force a username/email constraint conflict after releasing a claim and require
   restoration of both old-owner and requester state. Exercise invitation
   acceptance/retry, metadata PUT, login eligibility, password reset and refresh
   rotation. Verify no changes to unrelated users/sessions. No MFA implementation
   or MFA-specific regression suite currently exists in Identity.

These are deferred acceptance steps, not claims of tests already executed. Do not
deploy the client-only subtask as a completed BR-31 provisioning fix.
