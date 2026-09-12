# Shared Contract Strategy & Governance

## 1. Contract-First Architecture

LearnUP adopts a **Contract-First** philosophy for all synchronous REST endpoints and asynchronous Kafka event streams:

1. **Decoupled Collaboration**:
   - Contracts are the single source of truth between frontend (Next.js), platform services, and polyglot backend microservices (Spring Boot / NestJS).
   - Contracts are designed, reviewed, and versioned in the central `/contracts` repository directory before service implementation begins.
2. **P0 Contract Scope**:
   - **P0 defines only generic API and event contracts** (reusable headers, generic `ApiResponse<T>`, generic `ApiError`, offset pagination, and CloudEvent-compatible Kafka event envelope).
   - Domain-specific service contracts (e.g., Course, Learning, Identity endpoints) are strictly deferred to their respective implementation phases.

---

## 2. Synchronous REST Contracts (OpenAPI 3.0)

All REST interfaces are defined using OpenAPI 3.0 specification components located in `contracts/openapi/`:

| Contract File | Purpose |
| :--- | :--- |
| `headers.yaml` | Standard internal and external HTTP headers (`X-User-ID`, `X-Organization-ID`, `X-Correlation-ID`). |
| `api-response.yaml` | Standard success envelope format wrapping arbitrary data payloads. |
| `api-error.yaml` | Standard structured error envelope returned for all 4xx and 5xx responses. |
| `pagination.yaml` | Standard query parameters (`page`, `size`) and response metadata (`PageMeta`). |
| `security.yaml` | Standard `BearerAuth` HTTP JWT authorization scheme. |

---

## 3. Asynchronous Event Contracts (JSON Schema / AsyncAPI)

Kafka event messages are governed by JSON Schemas located in `contracts/events/`:

| Schema File | Purpose |
| :--- | :--- |
| `event-envelope.schema.json` | CloudEvent-compatible envelope defining event metadata (`id`, `source`, `type`, `time`, `organizationId`, `correlationId`, `data`). |

### 3.1 Event Versioning & Evolution Rules
To maintain seamless backward and forward compatibility across polyglot microservices:

1. **Additive Changes Only**:
   - New fields added to event `data` payloads MUST be optional.
   - Consumers must ignore unknown fields without throwing deserialization errors.
2. **Never Rename or Remove Fields**:
   - Fields must not be deleted or have their types altered within a major version.
3. **Major Version Bump for Breaking Changes**:
   - If a breaking schema change is unavoidable, a new event type and topic version MUST be introduced (e.g., `learnup.identity.user-registered.v2`).
   - Producers must dual-publish to both versions during migration windows until all consumers have been updated.

---

## 4. Contract Validation & Tooling Workflow

```
[ Central Contracts (/contracts) ]
         |
         +---------------------------------------+
         |                                       |
         v                                       v
[ Java Code Generation / Types ]       [ TypeScript Types / Interfaces ]
 (packages/common-java)                 (packages/common-ts/src/core)
         |                                       |
         v                                       v
[ Spring Boot Services ]                [ NestJS Services & Next.js UI ]
```

- Code generation and shared type libraries (`packages/common-java` and `packages/common-ts`) derive directly from these contracts, ensuring zero drift between services.
