# Tenant-verified email reuse: Identity integration contract

Tenant owns canonical users, deletion, membership and eligibility. Identity owns
credentials and its stored authentication records. Only Tenant can establish
whether a different canonical owner has been deleted or never existed.

## Business-rule references

The Tenant review uses the 22/10 numbering: **BR-39** for reuse after deletion and
**BR-38** for email as the unique login identity. The checked-in authoritative
`docs/source-of-truth/LearnUP_QuyTacNghiepVu.docx` still labels those rules BR-31
and BR-30 respectively; its BR-38/39 describe other rules. Until the updated
canonical document is supplied, BR-39 here is the review's alias for legacy BR-31,
not a change to business semantics. Test classes use the review's numbering.
Published commit/branch names and V5's historical BR-31 comment are retained.

## Authenticated Tenant existence contract

```http
GET /api/v1/internal/users/{canonicalUserId}/existence
X-Internal-Key: <private service credential supplied through the environment>
Accept: application/json
```

The existing private service channel authenticates the lookup. It supplies no
user-context or Organization headers. The response follows Tenant's global
`TransformInterceptor`, as does the separate sign-in-access endpoint:

```json
{
  "statusCode": 200,
  "message": "User existence checked",
  "data": { "exists": false }
}
```

Identity requires HTTP 200, `application/json` (charset parameters are allowed),
and at most 1024 body bytes. The envelope has exactly `statusCode` (integer 200),
`message` (string; its wording is not used for authorization), and `data`.
`data` must be an object with exactly one boolean `exists`. Duplicate fields,
trailing JSON, coercions, unknown fields, missing/null values and the former raw
`{"exists":false}` contract are rejected. No HTTP redirects or application
retries are permitted. Connect and read timeouts each remain three seconds.
Failures use fixed errors without retaining/logging upstream bodies or secrets.

| Tenant meaning/result | Identity provisioning result |
| --- | --- |
| `data.exists=true`: canonical row exists and is not soft-deleted, including Pending, disabled and suspended-Organization accounts | `409 EMAIL_IN_USE`; no writes |
| `data.exists=false`: canonical row is committed soft-deleted or nonexistent | Atomic email release and requester provisioning |
| 401/403/404, other non-200 status, malformed/untrustworthy body, network failure or timeout | `503 TENANT_UNAVAILABLE`; no writes |
| Database ownership/uniqueness/locking race | `409 CREDENTIAL_CONFLICT`; rollback |

An allowed/denied sign-in decision is never evidence of absence. Tenant must
return 200 with false for nonexistent IDs, not 404. The existence endpoint must
be a plain committed read: no registration email advisory lock, no locking user
read, no call to Identity and no wait for the caller to commit.

## Provisioning and local transaction guarantees

`POST /api/internal/credentials` retains its request fields and success envelope;
no public route or caller-supplied deletion proof is added. New and released
users require a valid email of at most 100 characters. Input is trimmed and
lowercased using `Locale.ROOT`, consistently with login/recovery/metadata.
An existing email-owning user may still omit email for supported password
replacement. No different owner, or the same canonical ID, follows the existing
workflow without a cross-user existence lookup.

Canonical IDs, BCrypt hashing, roles and Organization metadata retain their
semantics. Newly generated usernames use `user_` and the full compact UUID as in
develop; existing usernames, including legacy forms, remain stable on retries.
Full-name synchronization remains the separate metadata operation.

For a different owner, Identity snapshots scalar ownership, locks existing rows
in deterministic ID order with PostgreSQL NOWAIT, and revalidates ownership.
All user locks precede requester-token operations. Same-user provisioning keeps
the established user-row ordering. Unchanged unique email/username and primary
key constraints protect absent-row races. New canonical IDs use explicit INSERT,
not assigned-ID merge. Changed ownership is a conflict, never new orphan proof.
The Identity transaction/database-query budget is ten seconds, including unique
index waits; there is no automatic provisioning retry.

With rows locked, only authenticated Tenant false authorizes setting the old
email to NULL and flushing it before the requester claims the address. The old
canonical user, username, password hash, full name, role, Organization, enabled
flag, creation time and every stored refresh/recovery row remain. Only email and
the normal update timestamp change. Established requester-only password/token
replacement behavior remains. Any later write, constraint or cleanup failure
rolls back both sides of the local transition.

`PUT /api/internal/credentials/metadata` remains password-free and existing-ID-only;
it cannot create a new user or perform a cross-user handoff. See
[DEVELOPMENT.md](DEVELOPMENT.md) for its unchanged authentication/conflict contract.

## Released-record authentication and recovery

NULL-email records are excluded from login, including retained email-shaped
usernames that could shadow the current owner's email. Refresh/reset still
consult canonical Tenant eligibility, and reject released records even if an
eligibility response unexpectedly permits the ID. Old token rows, including
rotated refresh families, remain attached to the former owner. Old reset tokens
cannot alter either account's password. Recovery for the reused email targets
the new owner; obsolete delivery neither sends nor deletes the retained token.
Released profile/password-change requests are rejected even under an old JWT.

This does not globally revoke previously issued access JWTs at other services.
Tenant-owned lifecycle/authorization checks remain necessary. No MFA feature or
dedicated MFA suite is introduced by this change.

## Flyway V5 and rollout

`V5__allow_released_credential_email.sql` contains only:

```sql
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
```

V1-V5 are immutable here, including V5's historical rule-number comment. V5 may
already have been applied outside the disposable test environment; a comment
edit would change its Flyway checksum. Existing email values and all user/token
rows are preserved. `users_email_key`, username uniqueness and foreign keys stay
in force. PostgreSQL permits multiple NULL claims while non-null claims remain
unique. Normal credential creation still requires email.

Apply V5 before any application instance can release an email to NULL. Deploy
null-safe Identity code on every instance and coordinate Tenant's existence and
lifecycle-lock rollout before enabling cross-user reuse. Keep Identity private
and service credentials aligned. Once released rows exist, restoring NOT NULL
or deploying older null-unsafe/destructive code requires a separately reviewed
data/application plan. Do not rewrite applied migration history.

## Tenant serialization, visibility and failure requirements

Identity's locks end at its own commit and do not serialize Tenant's later
canonical commit. Tenant must serialize normalized-email lifecycle claims,
including registration, cancellation/deletion, invitations and retries, through
the protected canonical commit. An absence boolean alone cannot distinguish an
orphan from an in-flight registration.

A separate lock-only transaction can cover a multi-transaction registration if
its callback awaits the entire protected operation, including the canonical
transaction's commit. Acquiring a transaction lock in an earlier helper that
returns before the operation does not suffice. Lock-holder expiry, database
disconnection, HTTP timeout and pool saturation also need integration tests:
expiry of the lock-only transaction must not leave independent work continuing
without serialization. Budget every database/pool/HTTP wait; the existence read
must retain a separate available connection under concurrent registrations.

Soft deletion must commit before Identity's callback can see false. Uncommitted
deletion must conservatively return true without waiting for the caller's lock
or commit. Pending organizers count as existing. Tenant must preserve bounded
Identity HTTP waits and the agreed neutral UC02 handling of `409 EMAIL_IN_USE`;
Identity's other conflict and 503 outcomes require explicit caller handling too.

If Identity commits and Tenant later rolls back or loses the HTTP response, an
orphan credential may remain. Identity performs no destructive compensation or
automatic reverse handoff. Prefer retrying the same canonical ID; a different
ID must reverify existence under Tenant's serialization rules. Invitation
acceptance must retain its canonical ID on retries and activate only in Tenant.

## Disposable verification and real integration gate

From `services/identity-service`, use Java 21 and the service POM:

```powershell
mvn --batch-mode --offline "-Dmaven.repo.local=$env:USERPROFILE/.m2/repository" test
./src/test/scripts/Test-PasswordResetPostgres.ps1 -AllTests -MavenGoals clean,verify -Offline -MavenRepository "$env:USERPROFILE/.m2/repository"
```

The PostgreSQL wrapper requires an available Docker engine and `postgres:16-alpine`.
It creates only a guarded disposable database. An independent native PostgreSQL
16 cluster is also suitable with the guarded `IDENTITY_TEST_POSTGRES_*` variables:
loopback random port, database/user `identity_reset_test`, generated disposable
password and no shared storage. Never point tests at persistent LearnUP databases
or start the demo-account stack. `Br39CredentialProvisioningContract` exercises
H2 and real PostgreSQL transactions/concurrency with mocked Tenant authority and
loopback HTTP stubs. The migration test upgrades populated V4 to V5 and checks
values, token rows, uniqueness and multiple released NULL claims.

Keep PR #179 Draft until the following run against real services and new
disposable Identity/Tenant databases. Current run results belong in the PR body.

1. Apply V5; use private service URLs and independently generated test credentials.
   Verify the enveloped GET, auth denial, Pending/active/disabled/suspended true,
   and committed-deleted/nonexistent false.
2. Register through UC02, retry the same canonical request, reject a different ID
   for an existing owner, then reuse a committed-deleted and an orphan address.
   Compare complete old/unrelated user and token rows.
3. Hold canonical creation before commit and issue competing normalized-email
   registrations/invitations/handoffs. Verify lock lifetime, one owner and bounded
   responses. Test uncommitted deletion, expired lock-holder transactions, dropped
   lock connections, HTTP timeout, retries and pool saturation.
4. Inject Tenant auth/5xx/malformed/timeout failures and Identity constraint errors
   after a flushed release. Require 503/conflict and exact local rollback.
5. Force Tenant rollback after Identity success and test the agreed orphan/retry
   policy. Exercise invitation acceptance, metadata PUT, normal/released login,
   refresh/reset/recovery and secret-safe diagnostics.

Source review and Identity-only tests do not establish real Tenant-Identity
integration, deployment or distributed serialization.
