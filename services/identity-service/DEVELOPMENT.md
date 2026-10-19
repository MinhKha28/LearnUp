# Identity developer tooling

## Verified baseline and ownership

Use Java 21 and Maven with the service POM (Spring Boot 3.3.5). Tenant creates
canonical accounts and invokes authenticated `POST /api/internal/credentials`.
Identity public registration is removed. Protected user operations require a
valid access JWT and the internal channel credential; raw user/role/Organization
headers alone never authorize a request. Do not put the internal credential in a
browser or Swagger authorization dialog.

## Required configuration and account fixtures

Identity has no default JWT signing secret, internal-channel key or database
password. Supply these privately in the process environment or deployment secret
mechanism; never commit populated secret files. For a standalone instance:

| Variable | Required configuration |
| :--- | :--- |
| `JWT_SECRET` | A private, independently generated random signing secret of at least 32 UTF-8 bytes; exactly the same value in Gateway and Identity |
| `INTERNAL_SERVICE_KEY` | A different private random value of at least 32 UTF-8 bytes; exactly the same value in Gateway, Identity, Notification and Tenant's existing internal integration |
| `SPRING_DATASOURCE_PASSWORD` | The actual password of the configured local PostgreSQL user; no fallback |
| `SPRING_DATASOURCE_URL` | Connection to the intended database; defaults to local `identity_db` |
| `SPRING_DATASOURCE_USERNAME` | Database user; defaults to `postgres`, not a password |
| `TENANT_SERVICE_URL` | Reachable Tenant base URL; defaults to `http://localhost:8084` |
| `NOTIFICATION_SERVICE_URL` | Required explicit private Notification base URL; Compose supplies `http://notification-service:8082` |
| `PASSWORD_RECOVERY_FRONTEND_BASE_URL` | Required trusted frontend base URL, for example loopback `http://127.0.0.1:5173` locally; HTTPS outside loopback |

JWT/internal-key startup validation rejects missing, blank, short and the known
repository-default values. Length validation is not an entropy check: generate
random independent values rather than a repeated phrase or a copied test fixture.
Do not print secrets to troubleshoot a mismatch. Keep Identity and Gateway JWT
configuration aligned when rotating or deploying configuration. Public login and
refresh still need Tenant's normal access decision; a running Identity instance
alone is not a working authentication stack.

For root Compose, supply `JWT_SECRET`, `INTERNAL_SERVICE_KEY`, `DB_PASSWORD` and
`PASSWORD_RECOVERY_FRONTEND_BASE_URL`
before `docker compose config --quiet` / starting the stack. Compose passes
`DB_PASSWORD` into Identity's datasource password and requires it explicitly.
Gateway/Identity JWT wiring and Gateway/Identity/Notification/Tenant internal-key wiring must
agree. Other services' deployment secret validation is outside this Identity
change; a passing Compose render does not establish that the whole stack is secure.
Do not run `docker compose config` without `--quiet` in shared logs because rendered
environment values may contain secrets. Existing PostgreSQL volumes keep their
existing credentials: supplying a new environment value does not rotate the
database user's password. Do not reset a database to fix a configuration mismatch.
Use a least-privileged Identity database role in deployed environments; the local
`postgres` username fallback is not a production privilege recommendation. Shared
database role/network administration is outside this Identity change.

No backend secret belongs in frontend environment variables, browser storage or
bundled code. In particular, never set `VITE_DEV_INTERNAL_KEY` to a private service
key. A browser authenticates with its own access JWT through Gateway, not by
holding an internal service credential. Standalone developer instances should be
loopback-only; the normal Compose Identity service has no published host port.

### Automatic demo seeding is retired

`learnup.seed.enabled` (environment alias `LEARNUP_SEED_ENABLED`) defaults to
`false` in every profile. Compose explicitly supplies `false`. The former runner
could create fixed-ID users, delete conflicting credentials, restore a demo
password and re-enable disabled accounts on restart; none of those writes remain.
Restarting now preserves every existing credential and account state, including
changed passwords and deactivated accounts. Existing data is not cleaned up or
made secure merely by removing the runner.

Setting the legacy seed flag to `true` deliberately **fails startup without any
account writes**, including in local development. It is not a functioning opt-in
fixture feature. Production-like profiles (`docker`, `prod`, `production`,
`staging`) must never seed demo accounts. There is no supported
`LEARNUP_SEED_DEFAULT_PASSWORD` setting or embedded demo password. Do not reintroduce
one to make local login convenient.

Local demo accounts need a separately reviewed, explicit **Tenant-owned fixture
contract** before automated seeding can return. Coordinate with the Tenant owner
to prepare canonical users, roles, Organizations, membership and access state in a
dedicated disposable local database. Tenant must provision credentials using the
existing authenticated `POST /api/internal/credentials` integration with the same
canonical User IDs. A future fixture must be local-only, opt-in and non-destructive;
any fixture password must be provided privately for that disposable environment,
never embedded in deployed configuration. Do not create an Identity-only user,
call public registration, reset existing users or relax Tenant access decisions as
a substitute. This task does not add a fixture API or change the existing
provisioning contract.

Do not use a shared development or production database to test fixtures or startup
guards. Automated tests exercise disposable H2 storage with synthetic credentials;
they are not instructions for deployed data. Historical known demo passwords may
still exist in persisted databases or Git history; coordinate any necessary
credential rotation through the owning account lifecycle, not a startup reset.

## Local Swagger / OpenAPI

The Spring MVC UI starter is pinned to **2.6.0** because the official
[springdoc compatibility matrix](https://springdoc.org/v2/#what-is-the-compatibility-matrix-of-springdoc-openapi-with-spring-boot)
maps Boot 3.3.x to springdoc 2.6.x. The default configuration disables both JSON
documentation and UI. Spring Security additionally denies their routes unless
`local-docs` is active without `prod`, `production`, `docker` or `staging`.

1. Start the normal development stack/Gateway with privately supplied `JWT_SECRET`
   and `INTERNAL_SERVICE_KEY` (independent random values of at least 32 bytes),
   consistent across Gateway/Identity and the existing Tenant integration. Never
   copy checked-in test fixtures into these variables. Configure the normal
   PostgreSQL connection variables for the standalone documentation instance.
2. In the Gateway's **local development environment only**, include
   `http://127.0.0.1:8081` in `CORS_ALLOWED_ORIGINS`, alongside the frontend origins.
   Restart/recreate only your local Gateway to pick up that environment change.
   No wildcard origin or production CORS change is needed.
3. From `services/identity-service/`, run:

   ```powershell
   mvn spring-boot:run '-Dspring-boot.run.profiles=local-docs'
   ```

4. Open [Swagger UI](http://127.0.0.1:8081/swagger-ui/index.html).
   JSON is at [OpenAPI](http://127.0.0.1:8081/v3/api-docs); the redirect entry is
   `/swagger-ui.html`. The local profile binds only `127.0.0.1`, disables Eureka
   registration and automatic demo seeding, and does not publish a Docker port.
   Do not combine this mode with deployment profiles. Non-loopback binding is
   rejected when configuring the local OpenAPI bean.
5. The specification sends Try-it-out calls to `http://localhost:8088` (Gateway),
   not directly to the documentation instance. Override `LEARNUP_DOCS_GATEWAY_URL`
   for a different loopback Gateway port. The documentation instance need not
   register itself with Eureka; Gateway continues using its normal Identity service.
6. Sign in using an existing legitimately provisioned account. Enter only the
   returned access JWT in Swagger's **Authorize** Bearer field when calling a
   protected operation. Gateway validates it and supplies the private service key.
   Authorization persistence is disabled; do not paste real credentials/tokens
   into issue reports, examples or shared screenshots.

The specification covers both auth aliases (`/api/v1/auth/*`, `/api/auth/*`):
login, refresh, logout, change-password, forgot-password, reset-password and me.
Public login/refresh/recovery operations do not declare Bearer authentication.
Requests and successful response envelopes come from the actual validated DTOs;
major error responses use the common error envelope. No working secret examples
are supplied. Internal credential provisioning is hidden and excluded by path.

The Identity-local `/users/me` aliases are not in this Gateway-oriented auth
specification: Gateway routes `/users/me` to Tenant's canonical profile. Use
`/auth/me` for Identity's credential projection. Recovery email delivery, Google
login, and expired-access logout redesign are not supplied by this tooling work.

`docker-compose.yml` keeps Identity private. Do not publish its port for Swagger;
run this explicit standalone loopback-only mode instead. This is not a production
API explorer. Default/deployment-profile tests assert documentation is denied.

## Compiler tooling

### Lombok conventions

Spring Boot 3.3.5 manages Lombok **1.18.34**, retained rather than introducing an
independent version override. Java 21 support began in
[Lombok 1.18.30](https://projectlombok.org/changelog). The dependency is
`provided`/optional and excluded from the executable JAR. Maven explicitly runs
the Lombok and Spring Boot configuration processors; use the same configuration
when building in an IDE. See the [official Maven setup](https://projectlombok.org/setup/maven).

Only `UserResponse` accessors and `AuthController` constructor injection currently
use Lombok. DTO constructors and mapping semantics remain explicit. Prefer
`@Getter`, selective `@Setter` and `@RequiredArgsConstructor`; do not add `@Data`,
credential-bearing `toString()`, or generated entity relationship equality.
For IntelliJ, import/reload the Maven project, use JDK 21, and enable annotation
processing if IDE builds are used. Use Lombok support compatible with your IDE;
Maven's clean build is the authoritative check, not editor highlighting.

### MapStruct conventions

MapStruct **1.6.3** generates the single Spring `UserMapper` bean. Its explicit
eight-field allowlist replaces the former `UserResponse.fromUser` mapping in
login, refresh and current-user responses. Null input still returns null; role
enum serialization, nullable Organization, disabled state and timestamps are unchanged.
Credential hashes and unrelated source fields are not mapped, including future
source properties. Adding a public DTO field requires deliberate contract review
and a corresponding mapping/serialization test, not implicit entity copying.

Maven explicitly runs `mapstruct-processor`, Lombok, Boot's configuration processor
and `lombok-mapstruct-binding` **0.2.0** together, as required by the
[MapStruct/Lombok integration guide](https://mapstruct.org/documentation/stable/reference/html/#lombok).
Generated implementation: `target/generated-sources/annotations/com/learnup/identity/mapper/UserMapperImpl.java`.
Do not edit or commit that file. Reload Maven/enable IDE annotation processing
after processor changes. No mapper IDE plugin is required for Maven builds.

## Verification

### Password-reset lifecycle (ID-P2)

Recovery issuance, reset, password change and internal credential replacement
serialize on a database pessimistic lock of the owning Identity user. Reset first
resolves only token ownership, then re-reads the token after acquiring that lock.
A conditional database delete consumes only an unused token whose expiry is
strictly after the consumption time. Password replacement, recovery-token
revocation and refresh-session deletion commit or roll back together. Revoked and
consumed reset rows are deleted; the existing `used_at` check still rejects legacy
consumed rows. No new schema or reset-token response field is required.

A new recovery issuance revokes previous links. Successful reset/change/internal
replacement revokes every outstanding recovery link for that user. Login and
refresh acquire the same user lock before credential/session operations, avoiding
stale-password login and reversed User/Token lock ordering. Logout's separate
expired-access/session race redesign remains outside this change.

Reset refuses disabled Identity credentials and a denied Tenant access decision;
Tenant unavailability fails closed without consuming the link. It does not
activate accounts, change membership/roles or issue login tokens. This implements
the requested security boundary, not a new DOCX business rule. Recovery expiry
remains the existing 15-minute implementation setting. Frontend recovery
integration remains a separate UC07 dependency; raw tokens are
never returned or logged as a delivery substitute. Backend delivery is described below.

### Password recovery email (ID-P3)

`POST /api/v1/auth/forgot-password` and `/api/auth/forgot-password` retain the
validated email DTO and neutral response for known, unknown, disabled, denied,
throttled and dependency-failure cases. Identity creates no accounts and never
activates disabled credentials. The worker checks Tenant's existing account,
Organization and subscription access decision before sending; reset itself still
checks it again. A Tenant outage/denial sends no email and revokes that request's
token. Credentials, membership and business lifecycle remain Tenant-owned.

Identity locks the account, applies a persisted per-account recovery budget,
invalidates earlier links and stores only SHA-256 state with the existing
15-minute expiry. A transaction synchronization submits work **after successful
commit**; rollback submits nothing. The worker uses short database transactions
for preflight and exact-token revocation, with no database locks during Tenant or
Notification HTTP calls. Changing a password during a slow send remains possible.
P2's User-before-Token locking, atomic single use and refresh revocation are unchanged.

Delivery uses a bounded two-worker/100-entry process-memory queue, one HTTP attempt
per accepted request, 2-second connection and 5-second read timeouts, no redirects
and no automatic retries. The default engineering spam budget is **3 accepted
requests per account per 15 minutes**, serialized by the existing account lock.
It uses a reserved uppercase `PASSWORD_RECOVERY/v1/<user UUID>` namespace in the
existing throttle table; public login identifiers are always lowercased and
cannot address that namespace. No schema change/new business rule is introduced.
Further requests return the same neutral response and do not revoke the current
link. The window is fixed from the first accepted request; delivery failures also
consume budget. Limits are configurable under `learnup.recovery` within validated
bounds: `max-requests-per-window`, `window-minutes`, `worker-threads`,
`queue-capacity`, `connect-timeout-millis` and `read-timeout-millis`.

The trusted operator URL, never `Host`/forwarded headers, produces
`<PASSWORD_RECOVERY_FRONTEND_BASE_URL>/reset-password/<encoded token>`. HTTPS is
required except loopback HTTP for local development. Both base URLs reject
credentials, queries and fragments. Notification destinations are restricted to
private IPs, loopback or internal DNS conventions (single-label Compose names,
`.internal`, `.local`, `.svc`, `.svc.cluster.local`); this is syntax validation,
not DNS pinning or a substitute for trusted deployment DNS/network policy.

Identity posts `{recipientEmail, subject, body, templateCode}` to the real private
`/api/v1/notifications/email/send`, using `X-Internal-Key` and a sanitized UUID
correlation ID, never user-context/Authorization headers. The plaintext email uses
`IDENTITY_PASSWORD_RECOVERY`, fixed subject `LearnUP password recovery`, the
configured link, UTC expiration and single-use/newest-link guidance. Notification
stores only delivery metadata, not the body; recovery subjects and SMTP errors
are sanitized so bearer links do not enter its metadata, responses or logs.
Do not enable request-body/header tracing, JavaMail debug or recovery URL capture
at a proxy/APM. External mail providers/mailboxes necessarily handle the link;
their retention and TLS configuration remain operational responsibilities.

HTTP 201 is insufficient: only a valid successful envelope with `data.status=SENT`
records Identity delivery success. `FAILED`, `SIMULATED`, invalid envelopes,
authentication errors, unavailable/timeout responses and queue rejection produce
safe outcome events and revoke **only that request's token**, not any newer link.
SMTP acceptance is not an inbox-arrival guarantee. Revocation errors have a
distinct error event; an undelivered token can then remain hashed until expiry or
new issuance. Queue-rejection cleanup can wait for a spare database connection;
configured HTTP timeouts are not an absolute public-request latency guarantee.

There is intentionally no durable outbox/raw-token persistence and no background
retry: a crash after token commit can lose queued delivery. A transport timeout
may occur after SMTP accepted mail; its link is revoked conservatively. Users may
request a new link within the bounded budget. Overlapping sends can deliver an
older email after a newer one; only the latest unexpired link can reset a password.
These limitations are explicit, not an exactly-once delivery promise. Operational
events distinguish success/failure/simulation without email bodies/links/secrets.
`learnup.recovery.delivery-enabled=false` is an explicit transport-isolation mode
used by existing lifecycle tests; it sends nothing and logs `DISABLED`, never
`SENT`. Normal/default/Compose configuration enables delivery. Notification SMTP
must separately have `LEARNUP_MAIL_ENABLED=true` and valid SMTP settings for real
email. Its default is mock mode, which revokes the unsent Identity link.

Deploy Notification's authenticated boundary first, supplying the existing private
key to Notification as well as Identity/Tenant/Gateway. Both email aliases and log
routes reject missing/invalid credentials and user-context headers. Compose keeps
Identity and Notification host ports unpublished; services use private DNS.
Tenant's unchanged relay already sends the same key to the supported legacy alias.
It currently rejects nested `FAILED` and accepts `SIMULATED`; its TypeScript status
union still lists only `SENT|FAILED` and needs separately reviewed typing alignment.
Its unrelated development logging fallback is not used for Identity recovery.

To verify actual SMTP acceptance with real migrated PostgreSQL:

```powershell
# First build the actual Notification executable JAR (Java 21).
Set-Location ../notification-service
mvn clean verify
Set-Location ../identity-service
./src/test/scripts/Test-PasswordRecoveryEmail.ps1 -MavenGoals clean,verify
# Optionally add -Offline -MavenRepository 'C:\path\to\.m2\repository'.
```

The opt-in runner reuses the owned disposable PostgreSQL script, starts the actual
Notification JAR in an owned child JVM on loopback, migrates a separate
`notification_email_test` schema, and delivers JavaMail traffic to an in-memory
JDK SMTP receiver. Ephemeral secrets are process-only; receiver content/child
output are bounded memory, not saved to files. Cleanup stops only owned resources.
It verifies real HTTP provisioning/recovery/reset, configured URL despite a forged
Host, hash correspondence, single use, session revocation and Tenant-shaped legacy
email delivery. Additional persistence tests cover concurrent budgets, rollback,
failure revocation and no lock across delivery on both H2 and PostgreSQL. HTTP
client tests cover nested statuses, timeouts, redirects and secret-safe diagnostics.
Tenant decisions remain mocked; no external inbox, deployed Tenant or frontend is
verified. Ordinary `mvn test` skips opt-in PostgreSQL/SMTP tests when their guarded
environment is absent; that is not PostgreSQL/SMTP verification.

Frontend must implement/wire the recovery request and `/reset-password/:token`
screens, submit the token with the existing reset DTO, handle expiration/reuse,
avoid logging URLs and use a restrictive referrer policy. No frontend feature,
email delivery retry queue or Kafka integration is introduced here.

### Password-reset-only PostgreSQL verification

The shared transaction contract runs against isolated H2 and, when explicitly
requested, a fresh PostgreSQL container with the real V1-V4 Flyway migrations:

```powershell
# Requires Java 21, Maven, a running Docker daemon and cached postgres:16-alpine.
./src/test/scripts/Test-PasswordResetPostgres.ps1
# Entire Identity suite, including the PostgreSQL contract and clean packaging:
./src/test/scripts/Test-PasswordResetPostgres.ps1 -AllTests -MavenGoals clean,verify
```

The runner uses a unique labelled container, random loopback port and ephemeral
password, then stops only its verified owned container. It never connects to an
existing database. `-MavenRepository` and `-Offline` optionally reuse the owner's
Maven cache. Do not manually point `IDENTITY_TEST_POSTGRES_*` at shared databases.
Ordinary Maven runs skip the PostgreSQL wrapper if its explicit test URL is absent;
that skip does not verify PostgreSQL locking. Tenant remains mocked even when the
database is real, so these are not deployed end-to-end recovery/email tests.

Run `mvn clean verify` from the Identity directory. The default test profile uses
H2 with Flyway disabled and mocked Tenant access where declared; use the runner
above for reset-only PostgreSQL verification. Neither reset-only setup exercises
actual email delivery; use the separate ID-P3 SMTP runner for that coverage.
Gateway's own tests live in `gateway/api-gateway/`.
Never commit `target/`, generated sources, dependency caches or local secret files.
