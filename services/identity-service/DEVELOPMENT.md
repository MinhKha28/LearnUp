# Identity developer tooling

## Verified baseline and ownership

Use Java 21 and Maven with the service POM (Spring Boot 3.3.5). Tenant creates
canonical accounts and invokes authenticated `POST /api/internal/credentials`.
Identity public registration is removed. Protected user operations require a
valid access JWT and the internal channel credential; raw user/role/Organization
headers alone never authorize a request. Do not put the internal credential in a
browser or Swagger authorization dialog.

## Local Swagger / OpenAPI

The Spring MVC UI starter is pinned to **2.6.0** because the official
[springdoc compatibility matrix](https://springdoc.org/v2/#what-is-the-compatibility-matrix-of-springdoc-openapi-with-spring-boot)
maps Boot 3.3.x to springdoc 2.6.x. The default configuration disables both JSON
documentation and UI. Spring Security additionally denies their routes unless
`local-docs` is active without `prod`, `docker` or `staging`.

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

## Verification

Run `mvn clean verify` from the Identity directory. Tests use H2 with Flyway
disabled and mocked Tenant access where declared; they are not PostgreSQL or
deployed end-to-end verification. Gateway's own tests live in `gateway/api-gateway/`.
Never commit `target/`, generated sources, dependency caches or local secret files.
