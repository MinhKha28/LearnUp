# Identity Service (`services/identity-service`)

Core identity, user credential, authentication, and token management microservice for the LearnUP platform.

> Current secure tooling/setup: [DEVELOPMENT.md](DEVELOPMENT.md). Legacy registration
> examples below are historical: both public registration routes were removed by
> ID-H1, and ID-H2 no longer accepts raw identity headers as authentication proof.

> **Identity Service authenticates users and issues identity tokens. Fine-grained business authorization remains in business services.**

---

## 1. Responsibilities & Boundaries

### What Identity Service OWNS:
* User identity and account state (`User` entity).
* Password hashing and credential verification using **BCrypt**.
* JWT access token issuance (HMAC-SHA256) containing `sub`, `role`, and `organizationId`.
* Refresh token lifecycle (issuing, hashing, persisting, rotating, and revoking in `identity_db`).
* Current user profile retrieval (`GET /api/users/me`).

### What Identity Service DOES NOT Own:
* **No Organizations/Memberships**: Owned by **Organization & Commercial Service**.
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
* **Privilege Escalation Protection**: Public registration (`POST /api/auth/register`) rejects attempts to self-register as platform `ADMIN` with 403 Forbidden.
* **`organizationId`**: Canonical tenant identifier. Populated for organization members; nullable for global platform administrators (`ADMIN`).

---

## 4. API Endpoints

All APIs return standardized `ApiResponse<T>` envelopes.

### 4.1 Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "learner1",
  "email": "learner1@learnup.com",
  "password": "mySecurePassword123",
  "fullName": "Nguyen Van A",
  "role": "LEARNER",
  "organizationId": "d8e3b970-13f5-4c07-b2e8-4934a3621415"
}
```

### 4.2 Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "learner1",
  "password": "mySecurePassword123"
}
```
**Response**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "48b61c7e-e170-4f59-994c-8f4b00b0dc68-...",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

### 4.3 Refresh Token (Rotation)
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "48b61c7e-e170-4f59-994c-8f4b00b0dc68-..."
}
```
*Old refresh token is revoked immediately and replaced with a new token pair.*

### 4.4 Current User Profile
```http
GET /api/users/me
X-User-ID: 3fa85f64-5717-4562-b3fc-2c963f66afa6
```
**Response**:
```json
{
  "success": true,
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "username": "learner1",
    "email": "learner1@learnup.com",
    "fullName": "Nguyen Van A",
    "role": "LEARNER",
    "organizationId": "d8e3b970-13f5-4c07-b2e8-4934a3621415",
    "enabled": true,
    "createdAt": "2026-09-14T10:00:00Z"
  }
}
```
*(Credential hashes and refresh tokens are strictly omitted).*

---

## 5. Configuration & Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `SERVER_PORT` | `8081` | Service HTTP Port |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/identity_db` | PostgreSQL JDBC connection URL |
| `SPRING_DATASOURCE_USERNAME`| `postgres` | Database username |
| `SPRING_DATASOURCE_PASSWORD`| `postgres` | Database password |
| `EUREKA_CLIENT_SERVICEURL_DEFAULTZONE` | `http://localhost:8761/eureka/` | Eureka Discovery URL |
| `JWT_SECRET` | Required; no default | Private HMAC secret, at least 32 bytes; must match Gateway |
| `INTERNAL_SERVICE_KEY` | Required; no default | Private internal-channel secret, at least 32 bytes; matches Gateway/Tenant |
| `SECURITY_JWT_ACCESS_TOKEN_EXPIRATION_MINUTES` | `15` | Access token lifespan in minutes |
| `SECURITY_JWT_REFRESH_TOKEN_EXPIRATION_DAYS` | `7` | Refresh token lifespan in days |

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
