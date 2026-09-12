# Contract Versioning & Backward Compatibility Strategy

## 1. Principles of Contract Governance

LearnUP adopts strict contract-first governance across its polyglot ecosystem (Spring Boot, NestJS, Next.js). Contracts are the immutable agreements between producers and consumers.

### 1.1 Semantic Versioning for Contracts
All contracts follow Semantic Versioning (`MAJOR.MINOR.PATCH`):
- **MAJOR**: Breaking changes (field deletion, type changes, semantic alteration, new mandatory parameters).
- **MINOR**: Backward-compatible additive enhancements (new optional fields, new query parameters, new error codes).
- **PATCH**: Non-functional schema documentation fixes, typo corrections, or description refinements.

---

## 2. REST API Versioning Strategy

### 2.1 URI Path Versioning
- All public REST endpoints incorporate the major API version directly into the path:
  ```
  /api/v1/<resource-plural>
  ```
- Minor and patch revisions MUST NOT alter the URI path. They must maintain strict backward compatibility.

### 2.2 Backward Compatibility Rules for REST APIs
1. **Additive Response Fields**:
   - Producers may add new fields to the `data` payload of `ApiResponse<T>`.
   - Consumers (NestJS services, Next.js frontend) MUST implement the **Tolerant Reader Pattern** and ignore unrecognized response fields without failing.
2. **Optional Request Parameters**:
   - New query parameters or request body properties MUST be optional with sensible defaults.
3. **No Field Removals or Renames**:
   - Existing fields in request or response schemas must never be deleted or renamed within a major version.
4. **Stable Error Structure**:
   - The outer `ApiResponse` and `ApiError` envelope structures are frozen. All 4xx and 5xx responses must use the standardized `ApiError` format.

---

## 3. Kafka Event & Topic Versioning Strategy

### 3.1 Topic Naming Convention
Kafka topics embed the domain, event name, and major schema version:
```
learnup.<domain>.<event-name>.v<major-version>
```
*Examples:*
- `learnup.identity.user-registered.v1`
- `learnup.course.course-published.v1`

### 3.2 Event Schema Compatibility Rules
Kafka event schemas use JSON Schema validation and must uphold **Full Compatibility** (both backward and forward compatible within a major version):

| Action | Allowed within Major Version? | Rule |
| :--- | :--- | :--- |
| **Add New Field to `payload`** | ✅ Yes | The field MUST be optional. Consumers ignore unknown fields. |
| **Add Optional Metadata to Envelope** | ✅ Yes | Core envelope fields (`eventId`, `eventType`, `occurredAt`, `producer`, `payload`) remain unchanged. |
| **Remove Field from `payload`** | ❌ No | Requires a new major topic version (e.g. `v2`). |
| **Change Data Type of Existing Field**| ❌ No | Requires a new major topic version (e.g. `v2`). |
| **Make Optional Field Mandatory** | ❌ No | Requires a new major topic version (e.g. `v2`). |

### 3.3 Breaking Change Migration Strategy (Dual-Publishing)
When a breaking change is unavoidable:
1. Create a new topic with the incremented version: `learnup.<domain>.<event-name>.v2`.
2. Update the producer service to **dual-publish** identical domain events to both `v1` and `v2` topics.
3. Migrate consumer services one by one from `v1` to `v2`.
4. Monitor traffic on `v1` until consumption drops to zero.
5. Decommission the `v1` topic and retire the `v1` publisher code.

---

## 4. Cross-Language Implementation Guide

| Platform | Contract Source | Common Library Binding |
| :--- | :--- | :--- |
| **Spring Boot (Java)** | OpenAPI YAML / JSON Schema | `packages/common-java` (`ApiResponse`, `ApiError`, `GenericEventEnvelope`, `PageMeta`) |
| **NestJS (TypeScript)** | OpenAPI YAML / JSON Schema | `packages/common-ts/src/core` & `packages/common-ts/src/adapters/nestjs` |
| **Next.js (Frontend)** | OpenAPI YAML / JSON Schema | `packages/common-ts/src/core` (`ApiResponse`, `ApiError`, `PageMeta`, `PlatformRole`) |
