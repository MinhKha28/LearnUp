# BR-31 credential provisioning integration

## Identity implementation and schema

Base: `b2c2409` (including `712eacd` and `a891584`). Tenant owns canonical users,
deletion, membership and eligibility. Identity owns credentials and its records.

`V5__allow_released_credential_email.sql` only drops NOT NULL from `users.email`.
It preserves existing values, all users/token rows, `users_email_key`, username
uniqueness and foreign keys. PostgreSQL allows multiple NULLs under the existing
unique constraint while every non-null email still has at most one exact owner.
No historical migration is rewritten and no synthetic replacement email is used.

New credentials require a valid email of at most 100 characters. The request DTO
normalizes surrounding whitespace; provisioning, login and recovery use lowercase
with `Locale.ROOT`, consistent with metadata updates. The request fields and
`POST /api/internal/credentials` success envelope are unchanged. Existing users
with an email may still omit it during supported password replacement. New users
and released users cannot be provisioned without an email. JPA also rejects a new
NULL-email user at persist time; only a verified existing owner is released.

`AuthService.setCredentials()` delegates to `CredentialProvisioningService`.
No owner, or the same canonical owner, follows the existing supported creation or
password-replacement workflow without a Tenant existence lookup. Canonical UUIDs,
full-UUID generated usernames, password hashing, default roles and Organization
metadata retain their existing semantics. Existing full-name synchronization
continues to use the metadata operation.

| Different Identity owner: Tenant response | Identity result |
| --- | --- |
| `200 {"exists":true}` | `409 EMAIL_IN_USE`; no writes |
| `200 {"exists":false}` | Atomically release only the old email and provision the requester |
| 401/403, unexpected status/body, timeout, connection failure, 5xx | `503 TENANT_UNAVAILABLE`; no writes |
| Database uniqueness/lock conflict or ownership changed after the read | `409 CREDENTIAL_CONFLICT`; transaction rolls back |

Ambiguous legacy case variants are rejected with `EMAIL_IN_USE`; this operation
never repairs or deletes them. Invalid/missing new-user email yields 400.

## Transaction and preservation guarantees

The service takes a scalar ownership snapshot, locks existing accounts, and
revalidates ownership before changing anything. Ordinary provisioning uses the
existing requester-row lock, preserving same-user password/reset/refresh ordering.
Cross-user handoffs acquire both existing IDs in database ID order with
pessimistic write locks and a NOWAIT hint (PostgreSQL), avoiding reversed lock
waits. All account locks precede requester-token operations. PostgreSQL's unchanged
unique email and primary-key constraints arbitrate absent-row races. Creation
uses `persist`/INSERT, never assigned-ID `merge` that could overwrite a concurrently
created canonical record. A changed owner is rejected rather than reinterpreted
as an orphan. The transaction has a ten-second database/query timeout, including
unique-index waits. There is no automatic provisioning retry.

With both rows locked, only the authenticated Tenant lookup can authorize release.
The old email is set to NULL and flushed before the new claim. Old ID, username,
password hash, full name, role, Organization, enabled flag, creation time, refresh
sessions and recovery tokens remain intact. Only email and the normal update
timestamp change. The requester keeps established password replacement and
requester-only refresh/recovery revocation. Any later write/constraint/cleanup
failure rolls back the release and the requester together. Exceptions return fixed
application errors, never SQL details, credentials or Tenant bodies.

The metadata-only PUT is unchanged: existing ID only, no credential creation or
handoff. Its unique-constraint conflict behavior remains in force.

## Authentication and recovery compatibility

Released users are excluded from login lookup, so a retained username cannot
shadow the new owner's email, including email-shaped legacy usernames. Valid
nonreleased users still require Tenant sign-in eligibility. Released profiles and
password changes are rejected even under an already-issued access JWT. JWT claims
are ID/role/Organization based and have no email dependency; normal public user
responses continue to have an email. Mapping/serialization remain null-safe.

Refresh/reset resolve the old canonical ID and still consult Tenant eligibility;
a released user cannot receive credentials even if Tenant unexpectedly allows that
ID. Rejected refresh requests, including rotated-token reuse for a released user,
preserve its stored sessions. Old reset tokens cannot change either account's
password. Recovery issuance for the reused email targets only the new ID. Recovery
delivery checks are null-safe; obsolete jobs neither send to the released address
nor delete the retained user's recovery record. Explicit logout and other normal
user-directed revocation remain their existing separate operations.

This does not globally revoke previously issued access JWTs at other services.
Business-service access remains governed by Tenant-owned lifecycle checks. No MFA
implementation or dedicated MFA regression suite currently exists in Identity.

## Remaining Tenant integration dependencies

- Existence must use private `X-Internal-Key` and exactly HTTP 200 with the raw JSON
  object `{"exists":true|false}`. The client rejects envelopes, unknown fields,
  duplicate keys, coercion, missing/null booleans, trailing JSON and oversized
  bodies. Tenant must confirm whether its global response interceptor is bypassed.
  Sign-in eligibility denial, disabled/pending status or Organization suspension
  must never mean absence. The existing sign-in-access contract stays separate.
- The lookup must be a bounded, nonlocking committed read on a separate available
  connection. It must not acquire registration's email advisory/row locks or call
  Identity. Otherwise registration -> Identity -> existence can circularly wait.
  Account for connection-pool exhaustion as well as explicit locks.
- A soft deletion performed inside the still-open registration transaction is not
  visible to this callback: the old user correctly still exists. The current
  `expireRegistration()` commits before provisioning; Tenant's planned transaction
  restructuring must preserve committed visibility and email serialization.
- Tenant must serialize all competing email lifecycle operations through canonical
  commit, including registration, deletion/cancellation, invitations and retries.
  Identity locks end at its own commit. A boolean absence response cannot
  distinguish an orphan from a Tenant user that has not committed yet. Local tests
  do not prove distributed serialization.
- The client retains three-second connect/read timeouts, no application retries,
  no redirects, and sanitized failures. Tenant must bound its outbound HTTP,
  transaction and pool waits with budgets compatible with Identity's database
  deadline. It currently wraps all non-successful Identity responses as 503;
  Tenant must confirm intended treatment of `EMAIL_IN_USE`/`CREDENTIAL_CONFLICT`.
- If Identity commits but Tenant later rolls back, the requester is an orphan.
  Identity deliberately does not restore/reassign email or delete users as a
  compensation. Retry with the same canonical ID. A later different ID must pass
  existence verification again, after Tenant's lifecycle lock/commit rules apply.
  Invitation acceptance must likewise keep its canonical ID across retries;
  Identity does not activate Tenant users or consume invitation tokens.

## Verification and real integration procedure

Use Java 21 from `services/identity-service`:

```powershell
mvn --offline '-Dmaven.repo.local=C:/Users/Nguyen Hoang Dat/.m2/repository' test
./src/test/scripts/Test-PasswordResetPostgres.ps1 -AllTests -MavenGoals clean,verify -Offline -MavenRepository 'C:/Users/Nguyen Hoang Dat/.m2/repository'
```

The PostgreSQL runner requires an already-running Docker engine and a cached
`postgres:16-alpine`. It owns a fresh loopback-only database and never connects to
persistent `identity_db`/`tenant_db` or starts the demo-account stack. A separate
native PostgreSQL 16.15 cluster is also suitable when configured through the same
guarded `IDENTITY_TEST_POSTGRES_*` environment: database/user `identity_reset_test`,
random nondefault loopback port, generated disposable password, no shared storage.
H2 tests retain recoverable H2 lock-timeout connections to permit genuine rollback;
this test-only pool rule does not change PostgreSQL behavior or fabricate locks.

`Br31CredentialProvisioningContract` runs real security, persistence, transactions
and forced concurrency on H2 and PostgreSQL. Tenant decisions are mocked, with a
loopback HTTP stub exercising provisioning failure responses. PostgreSQL also
checks an actual unique-index timeout and migrates a populated separate V4 schema
to V5, preserving user/token values and validating real constraints.

Local verification on 2026-10-27 used Java 21.0.2 and `mvn clean verify` against an
owned native PostgreSQL 16.15 cluster because Docker was unavailable. Of 608 tests,
605 passed and three optional recovery-email end-to-end tests were skipped; there
were no failures or errors. All 129 PostgreSQL tests passed, including 42 BR-31
tests and the populated forward-migration test. The shared BR-31 contract also
passed all 41 H2 tests. Existing metadata, provisioning, reset, refresh, HTTP-client
and security suites passed. The disposable cluster was stopped afterward. Tenant
remained mocked/stubbed; no deployed Tenant/Identity workflow was tested.

Once Tenant's endpoint and lifecycle locks are available, run on new disposable
Identity and Tenant databases only:

1. Configure the private service URLs and independently generated disposable
   secrets through process environments; preserve Identity's internal network
   boundary. Apply V5 through Flyway on the disposable Identity database.
2. Call authenticated `GET /api/v1/internal/users/{id}/existence` for committed
   pending, active, disabled, soft-deleted and absent test IDs. Require raw 200
   true for the first three and false for the last two. Suspend an Organization
   and require true. Invalid/missing internal keys must be denied.
3. Register a synthetic email through UC02 and retry its exact canonical
   credential request. Require 200, one canonical Identity user, stable username
   and preserved supported metadata/password behavior.
4. Submit a different ID for a nondeleted owner. Require Identity 409
   `EMAIL_IN_USE` and unchanged rows/tokens; confirm Tenant's error translation.
5. Commit deletion/cancellation and register the same email under a new ID.
   Require a retained NULL-email old user and unchanged old credential/token
   fields. Repeat for an Identity orphan whose ID never committed in Tenant.
6. Hold a UC02 transaction before Tenant commit and issue competing registration
   and invitation claims. Verify the agreed single canonical email owner and
   bounded results after releasing it. Include concurrent handoffs, same-ID
   retries, uncommitted deletion visibility and connection-pool saturation.
7. Fail the disposable existence channel with 401/403/5xx, malformed data and
   timeout. Require Identity 503 with exact rollback. Restore it and retry the
   same requester ID. Also force an Identity uniqueness failure after release.
8. Force Tenant rollback after successful Identity provisioning. Verify retained
   old records, the orphan requester and the agreed same-ID recovery policy.
   Confirm no automatic compensation deletes or mutates another account.
9. Exercise Instructor/Learner invitation acceptance and retries, metadata PUT,
   normal and released-user login, profile/password change, refresh rotation and
   password reset. Verify old and unrelated stored records remain attached to
   their original IDs, and no credentials or raw errors enter responses/logs.

Identity-only verification is not a claim of real Tenant/Identity BR-31 integration
or deployment. Persistent LearnUP services and accounts are outside these tests.
