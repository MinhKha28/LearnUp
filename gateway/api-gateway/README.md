# Spring Cloud API Gateway (`gateway/api-gateway`)

Central reverse proxy, perimeter security gateway, and dynamic router for the LearnUP microservice platform.

---

## 1. Architectural Role & Responsibilities

The API Gateway is the single public entry point for all frontend client requests.

### Core Gateway Responsibilities:
* **Dynamic Routing**: Dispatches incoming `/api/**` HTTP requests through explicit routes, using Eureka (`lb://`) for Java supporting services and configured service URLs for NestJS business services.
* **Perimeter JWT Authentication**: Validates JWT cryptographic signatures, expiration times, and mandatory claims.
* **Header Sanitization & Spoofing Prevention**: Strips all client-supplied identity headers (`X-User-ID`, `X-Organization-ID`, `X-User-Role`, `X-Correlation-ID`).
* **Trusted Header Injection**: Injects verified identity claims from the validated JWT downstream.
* **Correlation ID Propagation**: Preserves or generates `X-Correlation-ID` and echoes it back in responses.
* **Global CORS**: Handles pre-flight OPTIONS requests and manages origins for the ReactJS frontend.
* **Gateway Error Handling**: Returns standardized JSON error envelopes (`{ success: false, error: { ... } }`) for 401, 403, 404, 500.

---

## 2. Security Boundaries

The Gateway removes client-supplied identity and internal headers. On protected routes it validates the bearer token, then forwards the verified identity and configured internal key. Downstream services authenticate requests and enforce role and tenant authorization. Identity requires a valid bearer token for its protected user endpoints. See [request authentication](../../docs/architecture/security.md).

## 3. JWT & Required Claims

The Gateway checks the JWT signature and expiration and requires a subject and recognized role. It propagates the organization claim when present. See the [configured public route whitelist](src/main/resources/application.yml).

---

## 4. Route Configuration Catalog

The gateway uses Eureka `lb://` routing for Java supporting services and configured service URLs for NestJS business services, as described in [ADR 0008](../../docs/adr/0008-docker-dns-for-business-services.md) and [service discovery](../../docs/architecture/service-discovery.md).

| Route ID | Path predicate(s) | Target | Notable filters |
| :--- | :--- | :--- | :--- |
| `identity-service-auth` | `/api/v1/auth/**`, `/api/auth/**` | `lb://IDENTITY-SERVICE` | Global JWT filter; configured public-path whitelist applies |
| `notification-service` | `/api/v1/notifications/**`, `/api/notifications/**` | `lb://NOTIFICATION-SERVICE` | Global JWT filter; configured public-path whitelist applies |
| `audit-service` | `/api/v1/audit/**`, `/api/audit/**` | `lb://AUDIT-SERVICE` | `GET` only; global JWT filter |
| `tenant-service` | `/api/v1/users/**`, `/api/v1/organizations/**`, `/api/v1/subscriptions/**`, `/api/v1/subscription-plans/**`, `/api/v1/registrations/**`, `/api/v1/invitations/**`, `/api/v1/payments/**`, `/api/v1/admin/subscription-plans/**`, `/api/v1/admin/organizations/**`, `/api/users/**`, `/api/organizations/**`, `/api/subscriptions/**`, `/api/subscription-plans/**`, `/api/registrations/**`, `/api/invitations/**`, `/api/payments/**`, `/api/admin/subscription-plans/**`, `/api/admin/organizations/**` | `TENANT_SERVICE_URL` | Global JWT filter; configured public-path whitelist applies |
| `course-service` | `/api/v1/courses/**`, `/api/courses/**` | `COURSE_SERVICE_URL` | Global JWT filter |
| `learning-service` | `/api/v1/learning/**`, `/api/v1/enrollments/**`, `/api/v1/assignments/**`, `/api/learning/**`, `/api/enrollments/**`, `/api/assignments/**` | `LEARNING_SERVICE_URL` | Global JWT filter |
| `assessment-service` | `/api/v1/assessments/**`, `/api/assessments/**` | `ASSESSMENT_SERVICE_URL` | Global JWT filter |
| `achievement-reporting-service` | `/api/v1/certificates/**`, `/api/v1/reports/**`, `/api/v1/governance/**`, `/api/certificates/**`, `/api/reports/**`, `/api/governance/**` | `ACHIEVEMENT_REPORTING_SERVICE_URL` | Global JWT filter |

No route defines a `StripPrefix` filter.

## 5. Configuration & Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `SERVER_PORT` | `8080` | External Gateway port |
| `EUREKA_CLIENT_SERVICEURL_DEFAULTZONE` | `http://localhost:8761/eureka/` | Eureka registration endpoint |
| `JWT_SECRET` | Required | JWT signing key |
| `INTERNAL_SERVICE_KEY` | Required | Key used to authenticate internal calls |
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
