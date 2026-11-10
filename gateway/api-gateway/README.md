# Spring Cloud API Gateway (`gateway/api-gateway`)

Central reverse proxy, perimeter security gateway, and dynamic router for the LearnUP microservice platform.

---

## 1. Architectural Role & Responsibilities

The API Gateway is the single public entry point for all frontend client requests.

### Core Gateway Responsibilities:
* **Dynamic Routing**: Dispatches incoming `/api/**` HTTP requests to microservices using Eureka service discovery (`lb://<SERVICE-NAME>`).
* **Perimeter JWT Authentication**: Validates JWT cryptographic signatures, expiration times, and mandatory claims.
* **Header Sanitization & Spoofing Prevention**: Strips all client-supplied identity headers (`X-User-ID`, `X-Organization-ID`, `X-User-Role`, `X-Correlation-ID`).
* **Trusted Header Injection**: Injects verified identity claims from the validated JWT downstream.
* **Correlation ID Propagation**: Preserves or generates `X-Correlation-ID` and echoes it back in responses.
* **Global CORS**: Handles pre-flight OPTIONS requests and manages origins for the ReactJS frontend.
* **Gateway Error Handling**: Returns standardized JSON error envelopes (`{ success: false, error: { ... } }`) for 401, 403, 404, 500.

---

## 2. Security Boundaries

> **Client-supplied identity headers are not trusted.**

> **Gateway authenticates requests, while business services enforce fine-grained authorization.**

```text
 Client (ReactJS)
       │
       │ Authorization: Bearer <JWT>
       ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                    Spring Cloud Gateway                     │
 │  1. Strip incoming client-spoofed X-User-*, X-Org-* headers │
 │  2. Validate JWT signature, expiration, and issuer          │
 │  3. Extract sub (userId), role, organizationId              │
 │  4. Inject trusted headers & forward:                       │
 │     - X-User-ID: <sub (user-id)>                            │
 │     - X-Organization-ID: <organization-id>                  │
 │     - X-User-Role: <ADMIN | ORGANIZER | INSTRUCTOR | LEARNER>│
 │     - X-Correlation-ID: <uuid>                              │
 └──────────────────────────────┬──────────────────────────────┘
                                │
               ┌────────────────┼────────────────┐
               │ (Direct REST)  │ (Direct REST)  │ (Direct REST)
               ▼                ▼                ▼
        Identity Service   Org Service    Business Services
        (Business Auth)  (Business Auth)  (Business Auth)
```

The Gateway does **NOT** enforce business authorization (e.g. whether an `ORGANIZER` can assign a course or an `INSTRUCTOR` can grade an exam). Fine-grained authorization logic resides strictly inside the respective downstream business services.

---

## 3. JWT & Required Claims

The Gateway validates HMAC-SHA256 tokens signed with a shared secret (`JWT_SECRET`).

### Expected JWT Payload:
```json
{
  "sub": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "role": "ORGANIZER",
  "organizationId": "d8e3b970-13f5-4c07-b2e8-4934a3621415",
  "iat": 1726310000,
  "exp": 1726317200
}
```

* `sub` (Required): Canonical User UUID string.
* `role` (Required): Must be exactly one of `ADMIN`, `ORGANIZER`, `INSTRUCTOR`, `LEARNER`. Unapproved or misspelled roles are rejected with 401 Unauthorized.
* `organizationId` (Optional/Contextual): Canonical organization UUID string.

### Whitelisted Public Routes (No JWT Required):
* `POST /api/auth/login`
* `POST /api/auth/register`
* `POST /api/auth/refresh`
* Certificate routes require JWT authentication; BR-264 excludes public certificate verification from the MVP.
* `GET /actuator/health`

---

## 4. Route Configuration Catalog

All routes map to dynamic Eureka service identifiers (`lb://<SERVICE-NAME>`):

| Route ID | Path Predicate | Target Service | Type |
| :--- | :--- | :--- | :--- |
| `identity-service-auth` | `/api/auth/**` | `lb://IDENTITY-SERVICE` | Supporting |
| `notification-service` | `/api/notifications/**` | `lb://NOTIFICATION-SERVICE` | Supporting |
| `audit-service` | `/api/audit/**` | `lb://AUDIT-SERVICE` | Supporting |
| `tenant-service` | `/api/users/**`, `/api/organizations/**`, `/api/subscriptions/**`, `/api/payments/**` | `lb://TENANT-SERVICE` | Business |
| `course-service` | `/api/courses/**` | `lb://COURSE-SERVICE` | Business |
| `learning-service` | `/api/learning/**` | `lb://LEARNING-SERVICE` | Business |
| `assessment-service` | `/api/assessments/**` | `lb://ASSESSMENT-SERVICE` | Business |
| `achievement-reporting-service` | `/api/certificates/**`, `/api/reports/**`, `/api/governance/**` | `lb://ACHIEVEMENT-REPORTING-SERVICE` | Business |


---

## 5. Configuration & Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `SERVER_PORT` | `8080` | External Gateway port |
| `EUREKA_CLIENT_SERVICEURL_DEFAULTZONE` | `http://localhost:8761/eureka/` | Eureka registration endpoint |
| `JWT_SECRET` | `devSecretKeyForLearnUpPlatformMustBeAtLeast32BytesLong` | 256-bit HMAC secret key |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Comma-separated allowed CORS origins |

---

## 6. Build & Run Instructions

### Prerequisites
* Java 21 & Maven 3.9+
* Eureka Server running on port `8761` (Phase P3)

### Build Application
```bash
# Run tests
mvn clean test

# Package JAR
mvn clean package
```

### Run Locally
```bash
# Run Spring Boot Gateway
mvn spring-boot:run

# Or run packaged JAR
java -jar target/api-gateway-1.0.0-SNAPSHOT.jar
```
