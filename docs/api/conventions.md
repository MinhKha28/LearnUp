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
  "success": true,
  "data": {
    "id": "e0b83e44-d890-411a-96ea-994c5e3d7491",
    "name": "Advanced Microservice Patterns",
    "status": "PUBLISHED"
  }
}
```

### 2.2 Error Response

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Course with ID e0b83e44-d890-411a-96ea-994c5e3d7491 does not exist.",
    "details": null
  }
}
```

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
* `page`: 0-indexed page number (default: `0`).
* `size`: Number of items per page (default: `20`, max: `100`).
* `sort`: Property and direction, e.g. `createdAt,desc` or `name,asc`.

**Rule**: Cursor-based pagination is explicitly prohibited to avoid unnecessary complexity. Simple offset/limit pagination is standard.

### Paginated Success Envelope:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "111e4567-e89b-12d3-a456-426614174000",
        "name": "Nguyen Van Muoi",
        "email": "deptrai@fpt.com",
        "tags": ["Sinh viên IT kỳ 4"]
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 142,
    "totalPages": 8,
    "first": true,
    "last": false
  }
}
```
