# REST API Standards & Conventions

This document establishes the uniform REST API conventions, URL patterns, envelope formats, and pagination standards for all LearnUP microservices.

---

## 1. URL Path & Resource Naming Conventions

* Use `/api/v1` for versioned Gateway API paths. The [Gateway route configuration](../../gateway/api-gateway/src/main/resources/application.yml) also lists compatibility predicates.
* Use lowercase plural nouns with hyphens for multi-word resource names. The paths below illustrate naming and nesting.
  * `/api/v1/organizations`
  * `/api/v1/course-assignments`
  * `/api/v1/peer-reviews`
* Sub-resources denote relationships:
  * `GET /api/v1/organizations/{organizationId}/learners`
  * `POST /api/v1/organizations/{organizationId}/tags`
  * `GET /api/v1/courses/{courseId}/modules`

### HTTP Verb Semantics:
* `GET`: Safe, idempotent retrieval of resource(s).
* `POST`: Creation of a new resource or initiating a business action.
* `PUT`: Complete idempotent replacement of an existing resource.
* `PATCH`: Partial update of specific fields of an existing resource.
* `DELETE`: Deletion or deactivation of a resource.

---

## 2. Standard Response Envelopes

Use the standard top-level envelope for JSON API responses. Binary responses stream the asset directly. Examples include [certificate PDFs](../../services/achievement-reporting-service/src/modules/certificates/certificates.controller.ts) and [signer signature assets](../../services/achievement-reporting-service/src/modules/certificates/signer.controller.ts).

### 2.1 Success Response

```json
{
  "statusCode": 200,
  "message": "Request completed",
  "data": {
    "id": "e0b83e44-d890-411a-96ea-994c5e3d7491",
    "name": "Advanced Microservice Patterns",
    "status": "PUBLISHED"
  }
}
```

### 2.2 Error Response

The shared `ApiErrorResponse` type describes the following envelope; `error` and `errorCode` are optional.

```json
{
  "statusCode": 404,
  "message": "Course with ID e0b83e44-d890-411a-96ea-994c5e3d7491 does not exist.",
  "error": "Not Found",
  "errorCode": "RESOURCE_NOT_FOUND",
  "timestamp": "2026-09-30T01:35:51.000Z",
  "path": "/api/v1/courses/e0b83e44-d890-411a-96ea-994c5e3d7491"
}
```

The `createApiError(code, message, details?)` helper returns an error payload `{code, message, details?}`; it omits absent or empty details. It does not create an HTTP response envelope. The services' HTTP exception filters currently serialize `{statusCode, timestamp, path, error}`, where `error` contains the exception payload. Follow the endpoint's filter for its wire format; the shared type alone does not transform responses.

### Common Error Codes:
* `UNAUTHORIZED`: Missing or invalid authentication token.
* `FORBIDDEN`: Insufficient role permissions or organization mismatch.
* `RESOURCE_NOT_FOUND`: Target resource ID not found.
* `VALIDATION_FAILED`: Request payload failed schema or business validation constraints.
* `BUSINESS_RULE_VIOLATION`: Operation violates domain invariants (e.g. assigning an unpublished course).
* `INTERNAL_SERVER_ERROR`: Unhandled runtime exception.

---

## 3. Standard Pagination Format

Paginated endpoints accept standard query parameters:
* `page`: 1-indexed page number (default: `1`). The helper preserves the supplied page number.
* Page size is endpoint-specific; some lists use a fixed size. The response reports it as `meta.pageSize`.
* `sort`: Property and direction, e.g. `createdAt,desc` or `name,asc`.

**Rule**: Cursor-based pagination is explicitly prohibited to avoid unnecessary complexity. Simple offset/limit pagination is standard.

### Paginated Success Envelope:

```json
{
  "statusCode": 200,
  "message": "Request completed",
  "data": {
    "items": [
      {
        "id": "111e4567-e89b-12d3-a456-426614174000",
        "name": "Nguyen Van Muoi",
        "email": "deptrai@fpt.com",
        "tags": ["Sinh viên IT kỳ 4"]
      }
    ],
    "meta": {
      "current": 1,
      "pageSize": 20,
      "pages": 8,
      "total": 142
    }
  }
}
```

`createPageResponse(items, page, size, totalElements)` returns `{meta, items}`. `meta.pages` is `Math.ceil(totalElements / size)` when size is positive, otherwise zero. An empty result has `items: []`, `meta.total: 0` and `meta.pages: 0`. There are no `first` or `last` fields.

## 4. Trusted Context Header Names

Use the lowercase names exported by `HEADER_NAMES`: `x-internal-key`, `x-user-id`, `x-organization-id`, `x-user-role`, and `x-correlation-id`. Node normalizes incoming header names to lowercase, so direct `request.headers` lookups use these exact keys. Callers must still meet each endpoint's authentication and organization-context requirements.
