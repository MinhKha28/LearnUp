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

The Gateway removes client-supplied identity and internal headers. On protected routes it validates the bearer token, then forwards the verified identity and configured internal key. Downstream services authenticate requests and enforce role and tenant authorization. Identity requires a valid bearer token for its protected user endpoints. See [request authentication](../../docs/architecture/security.md).

## 3. JWT & Required Claims

The Gateway checks the JWT signature and expiration and requires a subject and recognized role. It propagates the organization claim when present. See the [configured public route whitelist](src/main/resources/application.yml).

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
