# Identity Service (`services/identity-service`)

Core identity, user credential, authentication, and token management microservice for the LearnUP platform.

> Current secure configuration, local account fixtures and tooling:
> [DEVELOPMENT.md](DEVELOPMENT.md). Public registration is removed; raw identity
> headers are never authentication proof. Automatic demo account creation is disabled.

> **Identity Service authenticates users and issues identity tokens. Fine-grained business authorization remains in business services.**

---

## 1. Responsibilities & Boundaries

### What Identity Service OWNS:
* Credentials and an authentication-side user projection (`User` entity), using
  the canonical User ID supplied by Tenant. This is not independent account ownership.
* Password hashing and credential verification using **BCrypt**.
* HMAC JWT access token issuance containing `sub`, `role`, and `organizationId`.
* Refresh token lifecycle (issuing, hashing, persisting, rotating, and revoking in `identity_db`).
* Current user profile retrieval (`GET /api/users/me`).

### What Identity Service DOES NOT Own:
* **No canonical accounts, Organizations, memberships or business account lifecycle**:
  Owned by **Tenant Service**. Identity consults Tenant's access decision during
  login and refresh.
* **No Course/Enrollment/Assessment data**: Owned by respective business services.
* **No Business RBAC Permissions**: Authorization rules (e.g. whether an `ORGANIZER` can assign courses) reside in business services.


---

## 2. Database Ownership (`identity_db`)

Identity Service owns and exclusively manages the `identity_db` PostgreSQL database.

### Schema Entities (`V1__init_identity_schema.sql`):
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL,
    organization_id UUID,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 3. Four-Role Model & `organizationId` Semantics

* **Platform Roles**: Exactly four roles (`ADMIN`, `ORGANIZER`, `INSTRUCTOR`, `LEARNER`). No `SUPER_ADMIN` or arbitrary roles.
* **No public registration**: Both `/api/v1/auth/register` and `/api/auth/register`
  are unavailable for every role. Tenant-owned registration/activation provisions
  credentials through the authenticated internal integration, not a public Identity endpoint.
* **`organizationId`**: Canonical tenant identifier. Populated for organization members; nullable for global platform administrators (`ADMIN`).

---

## 4. API Endpoints

All APIs return standardized `ApiResponse<T>` envelopes.

Auth routes support both `/api/v1/auth` and `/api/auth`. Call them through Gateway.
Public requests must not supply internal credentials; protected requests supply
their own Bearer access JWT to Gateway, which supplies the private channel credential.

| Method | Auth route suffix | Access | Contract |
| :--- | :--- | :--- | :--- |
| POST | `/login` | Public | Existing `username` and `password`; checks credentials and Tenant access before returning the token pair and user projection |
| POST | `/refresh` | Public | `refreshToken`; rotates the token pair after validation and Tenant access checks |
| POST | `/forgot-password` | Public | `email`; neutral response, hash-only recovery-token persistence; email delivery is not yet integrated |
| POST | `/reset-password` | Public | `token`, `newPassword` and `confirmPassword`; validates a usable recovery token |
| POST | `/logout` | Bearer through Gateway | Optional refresh-token session revocation; logout-all targets only the verified caller |
| POST | `/change-password` | Bearer through Gateway | `currentPassword`, `newPassword` and `confirmPassword`; verifies current password first |
| GET | `/me` | Bearer through Gateway | Identity's credential projection, without credential hashes or raw stored tokens |

Successful login/refresh returns `accessToken`, `refreshToken`, `tokenType`,
`expiresIn`, `user` and Tenant's `accessMode` in the response data. The token values
are secrets; do not paste them into logs, shared examples or issue reports. An unexpired access JWT is still
required for logout; this task does not redesign expired-access logout.

Identity also exposes its protected `/api/v1/users/me` and `/api/users/me` aliases,
but Gateway routes `/users/me` to Tenant's canonical profile. Use `/auth/me` through
Gateway when inspecting Identity's projection. Do not use `X-User-ID`,
`X-Organization-ID` or `X-User-Role` as authorization. Tenant's credential
provisioning endpoint is internal-only and is not a replacement public registration API.

See the explicitly enabled local Swagger mode in [DEVELOPMENT.md](DEVELOPMENT.md)
for the actual validated DTOs and response schema.

---

## 5. Configuration & Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `SERVER_PORT` | `8081` | Service HTTP Port |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/identity_db` | PostgreSQL JDBC connection URL |
| `SPRING_DATASOURCE_USERNAME`| `postgres` | Database username |
| `SPRING_DATASOURCE_PASSWORD`| Required; no default | Database password supplied privately for standalone Identity; Compose uses required `DB_PASSWORD` |
| `EUREKA_CLIENT_SERVICEURL_DEFAULTZONE` | `http://localhost:8761/eureka/` | Eureka Discovery URL |
| `JWT_SECRET` | Required; no default | Private HMAC secret, at least 32 bytes; must match Gateway |
| `INTERNAL_SERVICE_KEY` | Required; no default | Private internal-channel secret, at least 32 bytes; matches Gateway/Tenant |
| `SECURITY_JWT_ACCESS_TOKEN_EXPIRATION_MINUTES` | `15` | Access token lifespan in minutes |
| `SECURITY_JWT_REFRESH_TOKEN_EXPIRATION_DAYS` | `7` | Refresh token lifespan in days |
| `LEARNUP_SEED_ENABLED` | `false` | Legacy seeding is disabled; setting `true` fails startup pending a reviewed Tenant-owned fixture contract |

No demo password is configured or supported. Identity never creates, deletes,
resets or re-enables demo accounts on restart. These defaults apply in standalone
and deployment profiles; Compose explicitly keeps seeding off. See the development
guide before preparing a disposable local account fixture.

---

## 6. Build & Run Instructions

```bash
# Run tests
mvn clean test

# Build executable JAR
mvn clean package

# Run locally
mvn spring-boot:run
```

Supply the required database and private authentication environment variables
before running. This command does not create a usable demo account. Keep the
normal Compose Identity port private; use Gateway for application requests and
the documented loopback-only mode for local Swagger.
