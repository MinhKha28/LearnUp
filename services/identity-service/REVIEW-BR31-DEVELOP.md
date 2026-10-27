# BR-31 review against current develop

## Baseline, synchronization and scope

- Target: `origin/develop` at `85af44fc84653ad78e708847d12b33b0b18f7d2f`.
  No `origin/dev` branch exists. GitHub confirms `develop` is the default branch.
- Canonical remote repository: `MinhKha28/LearnUp`; the configured
  `huangdat/LearnUp` URL redirects there. Remote configuration was not changed.
- Feature HEAD before synchronization: `d360eb2690b8460f1431723b86a558f97fde7f32`.
- Normal merge commit: `25818a7`, with parents `d360eb2` and `85af44f`.
  The single conflict was in `AuthService.setCredentials()`.
- Conflict resolution retains Tenant-verified provisioning and develop's compact
  full-UUID default username (`user_` plus all 32 hexadecimal digits). Existing
  usernames are not renamed. Both branches' regression coverage is retained.
- The UUIDv7 collision fix is already in the target via `595ddd0` / PR #172.
  This PR preserves that behavior; it does not introduce the upstream fix again.
- Unrelated historical commit `e3864f9` contains six demo-tool files despite its
  Identity-related title. Commit `3bc2547` neutralizes those files in the net PR
  diff without rewriting history. Their original bytes remain in Git and a local
  task backup. The original worktree's five pending demo-tool files are unchanged.
- All final changed files are inside `services/identity-service/`. Tenant,
  Gateway, frontend, Compose and other business-service files have no net PR diff.

## Compatibility and security findings

No unresolved critical Identity regression or unsafe migration was found in the
reviewed source and isolated tests. This is not approval for production rollout:
the following Tenant integration dependencies keep the PR in Draft.

| Severity | Finding and affected source | Consequence / required follow-up |
| --- | --- | --- |
| High: release blocker | `services/tenant-service/src/modules/internal-users/internal-users.controller.ts:20` only exposes POST lookup; no `GET /api/v1/internal/users/{userId}/existence` exists anywhere in the target Tenant source. | Real cross-user reuse receives an untrustworthy/missing lookup result and Identity fails closed with 503, retaining both accounts. Tenant must implement the agreed authenticated existence contract. |
| High: release blocker | `services/tenant-service/src/modules/registrations/registrations.service.ts:84` checks email, calls Identity at line 124 and starts canonical creation's transaction at line 145. No email-scoped advisory lock is implemented. | Identity commits cannot serialize Tenant's subsequent commit. A false existence result cannot distinguish an orphan from an in-flight Tenant registration. Tenant must cover competing registration/deletion/invitation lifecycle operations through canonical commit and verify this with real concurrent integration tests. |
| High: contract dependency | `services/tenant-service/src/common/interceptors/transform.interceptor.ts:27` wraps responses as `{statusCode,message,data}`. Identity's existence client deliberately accepts only raw `{exists:boolean}`. | A normally wrapped response is rejected with 503. Agree and implement an explicit raw response or a coordinated strict contract change; do not infer absence from sign-in denial or a 404. |
| Medium: availability | `services/tenant-service/src/infrastructure/clients/identity/identity.client.ts:39` has no explicit fetch timeout. Lines 62-67 translate every Identity non-success response into 503. | Bound HTTP, transaction and pool waits and decide how Identity's 409 codes should reach the caller. Do not create a callback that waits for the caller's email lock or recursively calls Identity. |
| Medium: rollback/retry policy | `services/tenant-service/src/modules/registrations/registrations.service.ts:120` generates new IDs before provisioning and canonical commit. There is no compensation/retry protocol for an Identity success followed by Tenant rollback. | An orphan may remain. Identity preserves it; Tenant must confirm canonical-ID reuse or another explicit safe retry policy. No automatic deletion or reverse handoff is implemented. |
| Low: adoption dependency | Tenant's Identity client currently only calls POST credentials; no caller of the new metadata-only PUT exists in the target. | Existing-ID metadata synchronization is independently verified but still requires Tenant-owner adoption when needed. Never use that PUT to create a new canonical user. |
| Resolved: merge compatibility | Develop uses compact full-UUID usernames, whereas the earlier feature used hyphenated full UUIDs for new users. | Provisioning now calls develop's default-name helper. Existing legacy usernames remain unchanged; upstream and feature tests pass together. |
| Resolved: PR scope | Six committed demo-tool files came from `e3864f9`. | Removed from the final tree relative to develop in a separate scoped commit. No pending original-worktree file was staged or modified. |

### Tenant authentication, eligibility and visibility

The current Tenant `InternalAuthGuard` validates `X-Internal-Key` using a constant-
time digest comparison. `@ServiceCall()` skips user-context headers only after
validating that key. This is compatible with Identity's private sign-in-access
client. The new existence endpoint must use the same authenticated boundary.

Tenant sign-in eligibility correctly denies nonexistent or soft-deleted users as
`ACCOUNT_NOT_FOUND`; pending/deactivated users and suspended Organizations have
separate denials. Identity never converts those policy denials into existence
proof. The sign-in-access envelope remains unchanged.

`expireRegistration()` at line 520 commits soft deletion in its own awaited
transaction before the current provisioning call, so that deletion would be
visible to a later committed read. A future all-in-one registration transaction
cannot assume the callback sees its uncommitted deletion: it must conservatively
see the old owner as existing. Waiting for the caller to commit, or taking its
advisory lock, would create a circular service wait. The endpoint/locking code is
absent, so nonblocking callback behavior has not been verified end to end.

Invitation acceptance keeps `token.userId`, provisions before consuming the
invitation/activating Tenant, and can retry that same ID. The request fields and
uppercase role conversion match Identity. This is source-level compatibility,
with Identity-side invitation-style tests; real cross-service execution is pending.

### Identity invariants reviewed

| Scenario | Evidence and result |
| --- | --- |
| First-time registration | Valid email required, canonical UUID retained, compact username, BCrypt hash and safe response; isolated H2/PostgreSQL tests. |
| Same-user provisioning / retry | No cross-user lookup; stable existing username/creation time; only requester sessions/recovery tokens undergo established revocation. |
| Nondeleted owner | Mock authoritative true gives 409 `EMAIL_IN_USE` with all rows unchanged, including disabled Identity accounts / denied sign-in policy. |
| Soft-deleted or orphan owner | Mock authoritative false permits a transactional NULL release; old user, hash, metadata and stored token rows remain. |
| Concurrent first claims | Real PostgreSQL unique constraint chooses one winner; the loser rolls back with 409. |
| Concurrent handoffs | Real owner-row contention rejects the loser without checking a newly appeared owner as an orphan. |
| Ownership changes after preflight | Scalar snapshot plus locked revalidation rejects the stale request without mutating the new owner. |
| Concurrent canonical-ID creation | Explicit INSERT cannot merge over a record created after the read; primary-key conflict restores the release. |
| Tenant HTTP failures | Loopback HTTP tests cover 401/403/5xx, malformed/missing/coerced bodies, disconnect and timeout; 503 and exact database preservation. |
| Identity rollback | Unique violations after release and forced failure after requester cleanup restore account/token snapshots. |
| Tenant rollback | Source review only; orphan/retry lifecycle requires Tenant integration tests. |
| Invitation acceptance | Identity tests retain the canonical ID and still require Tenant activation before login. |
| Old/unrelated token preservation | Full database snapshots include valid/revoked/rotated refresh families and used/unused recovery rows. |
| Released authentication / recovery | Username/email cannot authenticate the released record; refresh/reset cannot issue or replace credentials even if mocked eligibility later allows it. Old JWT profile/password changes are denied. Obsolete recovery delivery neither sends nor deletes retained recovery records. |
| Internal authentication / redaction | Real filter/controller tests reject invalid internal keys and forwarded identity headers; logging/client/error tests pass without emitting secrets or Tenant response bodies. |

Authentication remains internal-only where required. No public registration or
provisioning alias is added, and Identity still has no published host container
port. Existing JWTs are not globally revoked at other services; Tenant-owned
lifecycle/authorization remains necessary. Credential entities are not public
response bodies. The metadata operation remains password-free and existing-ID-only.

## Database review

Only `V5__allow_released_credential_email.sql` is added relative to develop.
V1-V4 are unchanged and there are no duplicate Flyway versions. V5 only drops
NOT NULL from `users.email`; existing values, the unique constraint and foreign
keys are preserved. New account creation still requires a valid email. Released
users are rejected by relevant authentication/recovery paths without null errors.

The PostgreSQL migration test populates a separate V4 schema with users and token
records, migrates to V5, compares existing values and verifies actual uniqueness
and multiple released NULL claims. No persistent LearnUP database was accessed.

## Fresh verification after synchronization

Run date: 2026-10-27. Java 21.0.2, the service Maven POMs, and the owner's existing
Maven cache were used. These counts come from the synchronized source, not the
previous `d360eb2` run.

| Verification | Result |
| --- | --- |
| Focused Identity provisioning / BR-31 / controller tests | 114 passed; subset of the full run below. |
| Full Identity `mvn clean verify` | 610 discovered: 607 passed, 3 optional recovery-email end-to-end tests skipped, zero failures/errors; executable package built. |
| Real isolated PostgreSQL 16.15 suites | 129 passed, including 42 BR-31 tests and the populated forward-migration test. |
| Shared BR-31 H2 contract | 41 passed. |
| Gateway `mvn test` | 43 passed, zero failures/errors/skips. |
| Real Tenant-Identity integration | Not run: required Tenant existence endpoint and email locking are absent in the selected target. Docker's engine is also unavailable; it was not started. |
| Diff / scope checks | No unresolved conflicts, whitespace errors, generated artifacts, environment files or demo-tool paths in the net PR diff. |

Identity was run with a fresh native PostgreSQL 16.15 cluster on a random
loopback-only port using the guarded `identity_reset_test` database/user and a
new generated disposable password. Only process-local test variables were set.
The exact owned cluster was stopped afterward. No demo stack, persistent database,
real account, external message delivery or persistent container was used.

Commands, with the equivalent owner-cache path expressed portably:

```powershell
# From services/identity-service, with only the guarded disposable test DB configured:
mvn --batch-mode --offline "-Dmaven.repo.local=$env:USERPROFILE/.m2/repository" clean verify
# From gateway/api-gateway:
mvn --batch-mode --offline "-Dmaven.repo.local=$env:USERPROFILE/.m2/repository" test
```

When Docker is already available, the checked-in reproducible database wrapper is:

```powershell
# From services/identity-service:
./src/test/scripts/Test-PasswordResetPostgres.ps1 -AllTests -MavenGoals clean,verify -Offline -MavenRepository "$env:USERPROFILE/.m2/repository"
```

## Deployment / merge gates

Keep the PR Draft until the Tenant endpoint/response contract, lifecycle locking,
committed visibility and real concurrent registration/invitation/rollback tests
are available and verified together. Apply forward Flyway V5 before code that
releases an email to NULL can run. Keep Identity private and service secrets
aligned. Do not rewrite migration history or roll back nullability after released
rows exist without a separately reviewed migration/data plan. No deployment is
performed by this task. The detailed disposable integration procedure remains in
[BR31-INTEGRATION.md](BR31-INTEGRATION.md).

## Complete net changed-file list

The paths below are the final comparison against the selected development target,
including this report. Historical commits are retained; the unrelated demo-tool
addition is neutralized and has no net file changes in this list.

```text
services/identity-service/BR31-INTEGRATION.md
services/identity-service/DEVELOPMENT.md
services/identity-service/REVIEW-BR31-DEVELOP.md
services/identity-service/src/main/java/com/learnup/identity/client/TenantAccessClient.java
services/identity-service/src/main/java/com/learnup/identity/config/SecurityConfig.java
services/identity-service/src/main/java/com/learnup/identity/controller/internal/InternalCredentialController.java
services/identity-service/src/main/java/com/learnup/identity/domain/User.java
services/identity-service/src/main/java/com/learnup/identity/dto/internal/SetCredentialsRequest.java
services/identity-service/src/main/java/com/learnup/identity/dto/internal/UpdateUserMetadataRequest.java
services/identity-service/src/main/java/com/learnup/identity/exception/CredentialProvisioningConflictException.java
services/identity-service/src/main/java/com/learnup/identity/exception/IdentityExceptionHandler.java
services/identity-service/src/main/java/com/learnup/identity/repository/CredentialUserInsert.java
services/identity-service/src/main/java/com/learnup/identity/repository/CredentialUserInsertImpl.java
services/identity-service/src/main/java/com/learnup/identity/repository/UserRepository.java
services/identity-service/src/main/java/com/learnup/identity/security/IdentityRequestAuthenticationFilter.java
services/identity-service/src/main/java/com/learnup/identity/service/AuthService.java
services/identity-service/src/main/java/com/learnup/identity/service/CredentialProvisioningService.java
services/identity-service/src/main/java/com/learnup/identity/service/RecoveryDeliveryState.java
services/identity-service/src/main/java/com/learnup/identity/service/UserMetadataService.java
services/identity-service/src/main/resources/db/migration/V5__allow_released_credential_email.sql
services/identity-service/src/test/java/com/learnup/identity/client/TenantAccessClientTest.java
services/identity-service/src/test/java/com/learnup/identity/config/OpenApiDocumentationTest.java
services/identity-service/src/test/java/com/learnup/identity/controller/AuthControllerIntegrationTest.java
services/identity-service/src/test/java/com/learnup/identity/service/AuthServiceLoggingTest.java
services/identity-service/src/test/java/com/learnup/identity/service/Br31CredentialProvisioningContract.java
services/identity-service/src/test/java/com/learnup/identity/service/Br31CredentialProvisioningIntegrationTest.java
services/identity-service/src/test/java/com/learnup/identity/service/Br31CredentialProvisioningPostgresIntegrationTest.java
services/identity-service/src/test/java/com/learnup/identity/service/CredentialEmailMigrationPostgresTest.java
services/identity-service/src/test/java/com/learnup/identity/service/CredentialProvisioningContract.java
services/identity-service/src/test/java/com/learnup/identity/service/CredentialProvisioningIntegrationTest.java
services/identity-service/src/test/java/com/learnup/identity/service/CredentialProvisioningPostgresIntegrationTest.java
services/identity-service/src/test/java/com/learnup/identity/service/UserMetadataContract.java
services/identity-service/src/test/java/com/learnup/identity/service/UserMetadataIntegrationTest.java
services/identity-service/src/test/java/com/learnup/identity/service/UserMetadataPostgresIntegrationTest.java
services/identity-service/src/test/java/com/learnup/identity/support/H2LockTimeoutExceptionOverride.java
services/identity-service/src/test/resources/application-test.yml
```
