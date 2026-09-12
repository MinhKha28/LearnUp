# Cross-Cutting Concerns Specification

## 1. Request Correlation & Distributed Context

### 1.1 Correlation ID Flow
1. **Edge Ingress**: The Spring Cloud Gateway inspects the `X-Correlation-ID` header on incoming requests. If absent, the Gateway generates a unique UUID (e.g. `c7a31b20-1e82-4f11-9a70-8b77a942001e`) and attaches it to the request and response headers.
2. **Inter-Service Propagation**: Microservices (Spring Boot / NestJS) extract `X-Correlation-ID` upon receiving requests and propagate it via HTTP client headers or Kafka event `correlationId` fields.
3. **OpenTelemetry as Future Extension**: Full distributed tracing via OpenTelemetry SDK / Jaeger / Zipkin is documented as a future platform enhancement; P0 standardizes strictly on Correlation IDs.

---

## 2. Structured JSON Logging

All microservices MUST emit structured JSON logs to standard output (`stdout`) to facilitate centralized log ingestion (e.g. ELK, Fluentbit, Loki).

### 2.1 Standard Log Schema Fields
Every log statement MUST contain the following contextual fields:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `timestamp` | String | ISO-8601 UTC timestamp (`2026-09-12T10:00:00.123Z`). |
| `level` | String | `DEBUG`, `INFO`, `WARN`, `ERROR`. |
| `service` | String | Name of the emitting service (e.g. `identity-service`). |
| `correlationId` | String | Active correlation ID from `X-Correlation-ID`. |
| `organizationId` | String | Active tenant organization ID (if in authenticated scope). |
| `userId` | String | Active user ID (if in authenticated scope). |
| `message` | String | Human-readable log message. |
| `stack_trace` | String | Formatted exception stack trace (on ERROR level). |

---

## 3. Health Checks & Observability

Every service MUST expose standard liveness and readiness health endpoints for container orchestration:

- **Spring Boot Services**:
  - Endpoint: `/actuator/health`
  - Liveness probe: `/actuator/health/liveness`
  - Readiness probe: `/actuator/health/readiness`
- **NestJS Services**:
  - Endpoint: `/healthz`
  - Integrated via NestJS Terminus checking database and Kafka connectivity.

---

## 4. Offset-Based Pagination Standard (MVP)

> [!NOTE]
> In MVP (P0), pagination is standardized strictly on **Offset/Page-based pagination**. Cursor-based pagination is deferred.

### 4.1 Query Parameters
- `page` (integer, default `0`, 0-indexed): The page number requested.
- `size` (integer, default `20`, max `100`): The number of items per page.
- `sort` (string, optional, e.g. `createdAt,desc`): Sorting field and direction.

### 4.2 Response Metadata (`PageMeta`)
All paginated API responses return data inside the `data` array with metadata in `meta`:

```json
{
  "page": 0,
  "size": 20,
  "totalElements": 142,
  "totalPages": 8,
  "hasNext": true,
  "hasPrevious": false
}
```

---

## 5. Unified Error Handling & Error Codes

All unhandled exceptions and validation errors are intercepted by global exception handlers (`GlobalExceptionHandler` in Java, `HttpExceptionFilter` in NestJS) and transformed into the standard `ApiError` envelope:

| Error Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `INVALID_INPUT` | 400 Bad Request | Request payload failed validation rules. |
| `UNAUTHORIZED` | 401 Unauthorized | Missing or expired authentication credentials. |
| `FORBIDDEN` | 403 Forbidden | User does not have the required role or organization scope. |
| `RESOURCE_NOT_FOUND`| 404 Not Found | The requested entity does not exist. |
| `CONFLICT` | 409 Conflict | State conflict (e.g. duplicate email registration). |
| `RATE_LIMITED` | 429 Too Many Requests | Organization or client rate limit exceeded. |
| `INTERNAL_ERROR` | 500 Internal Server Error | Unhandled platform error (details hidden in production). |
