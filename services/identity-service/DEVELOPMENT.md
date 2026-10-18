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
| `INTERNAL_SERVICE_KEY` | A different private random value of at least 32 UTF-8 bytes; exactly the same value in Gateway, Identity and Tenant's existing internal integration |
| `SPRING_DATASOURCE_PASSWORD` | The actual password of the configured local PostgreSQL user; no fallback |
| `SPRING_DATASOURCE_URL` | Connection to the intended database; defaults to local `identity_db` |
| `SPRING_DATASOURCE_USERNAME` | Database user; defaults to `postgres`, not a password |
| `TENANT_SERVICE_URL` | Reachable Tenant base URL; defaults to `http://localhost:8084` |

JWT/internal-key startup validation rejects missing, blank, short and the known
repository-default values. Length validation is not an entropy check: generate
random independent values rather than a repeated phrase or a copied test fixture.
Do not print secrets to troubleshoot a mismatch. Keep Identity and Gateway JWT
configuration aligned when rotating or deploying configuration. Public login and
refresh still need Tenant's normal access decision; a running Identity instance
alone is not a working authentication stack.

For root Compose, supply `JWT_SECRET`, `INTERNAL_SERVICE_KEY` and `DB_PASSWORD`
before `docker compose config --quiet` / starting the stack. Compose passes
`DB_PASSWORD` into Identity's datasource password and requires it explicitly.
Gateway/Identity JWT wiring and Gateway/Identity/Tenant internal-key wiring must
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

Run `mvn clean verify` from the Identity directory. Tests use H2 with Flyway
disabled and mocked Tenant access where declared; they are not PostgreSQL or
deployed end-to-end verification. Gateway's own tests live in `gateway/api-gateway/`.
Never commit `target/`, generated sources, dependency caches or local secret files.
