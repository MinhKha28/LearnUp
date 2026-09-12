# LearnUP Shared Cross-Language Contracts

This directory contains the technology-neutral, contract-first specifications governing communication across **Spring Boot services**, **NestJS services**, and the **Next.js frontend**.

---

## 1. Directory Structure

```
contracts/
├── json-schemas/                     # Technology-neutral JSON Schema definitions
│   ├── jwt-claims.schema.json        # JWT Claims: sub, role, organizationId, iat, exp
│   ├── api-response.schema.json      # Standard API response envelope
│   ├── pagination-response.schema.json # PageMeta metadata schema
│   ├── api-error.schema.json         # Standard ApiError schema
│   ├── error-codes.schema.json       # Canonical ErrorCode enum
│   ├── roles.schema.json             # Canonical PlatformRole enum
│   └── kafka-event-envelope.schema.json # Event envelope: eventId, eventType, occurredAt, producer, payload
├── openapi/                          # Reusable OpenAPI 3.0 component specifications
│   ├── jwt.yaml                      # JWT Claims schema
│   ├── api-response.yaml             # ApiResponse<T> schema
│   ├── pagination.yaml               # Page parameters & PageMeta schema
│   ├── api-error.yaml                # ApiError and ErrorDetail schemas
│   ├── error-codes.yaml              # ErrorCode enum schema
│   ├── roles.yaml                    # PlatformRole enum schema
│   ├── headers.yaml                  # X-User-ID, X-Organization-ID, X-Correlation-ID
│   └── security.yaml                 # BearerAuth JWT security scheme
├── events/                           # Kafka event definitions & schemas
│   └── kafka-event-envelope.schema.json
└── docs/                             # Contract documentation & governance
    ├── versioning-and-compatibility.md # SemVer, API & topic versioning, backward compatibility
    └── error-code-catalog.md          # Machine-readable error codes & resolution guide
```

---

## 2. Implemented Contracts Summary

| Contract | Schema Format | Description & Key Fields |
| :--- | :--- | :--- |
| **1. JWT Contract** | `jwt-claims.schema.json` / `jwt.yaml` | Claims: `sub`, `role`, `organizationId`, `iat`, `exp`, `iss`, `aud`. |
| **2. Standard API Response** | `api-response.schema.json` / `api-response.yaml` | `ApiResponse<T>`: `success`, `data`, `meta`, `error`, `timestamp`. |
| **3. Pagination Response** | `pagination-response.schema.json` / `pagination.yaml` | `PageMeta`: `page`, `size`, `totalElements`, `totalPages`, `hasNext`, `hasPrevious`. |
| **4. Standard Error Response** | `api-error.schema.json` / `api-error.yaml` | `ApiError`: `code`, `message`, `details` (`field`, `issue`), `correlationId`. |
| **5. Error Code Catalog** | `error-codes.schema.json` / `error-codes.yaml` | `INVALID_INPUT`, `UNAUTHORIZED`, `FORBIDDEN`, `RESOURCE_NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`. |
| **6. Kafka Event Envelope** | `kafka-event-envelope.schema.json` | Fields: `eventId`, `eventType`, `occurredAt`, `producer`, `payload`, `organizationId`, `correlationId`. |
| **7. Shared Role Enum** | `roles.schema.json` / `roles.yaml` | `ADMIN`, `ORGANIZER`, `INSTRUCTOR`, `LEARNER`. |
| **8. Versioning & Compatibility** | `docs/versioning-and-compatibility.md` | Full SemVer, backward/forward compatibility, and dual-publishing migration guide. |
