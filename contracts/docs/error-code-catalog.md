# Standard Error Code Catalog & Resolution Guide

## 1. Overview

LearnUP standardizes error communication across all microservices and frontend clients. Every API error returns an HTTP status code matching RFC 9110 and an `ApiError` payload containing a canonical machine-readable error code.

---

## 2. Platform Error Code Catalog

| Error Code | HTTP Status | Description | Typical Scenario | Client Action |
| :--- | :--- | :--- | :--- | :--- |
| `INVALID_INPUT` | `400 Bad Request` | Request payload failed schema or business validation rules. | Missing required fields, invalid email format, negative pagination parameters. | Highlight offending fields to user using `details` array. |
| `UNAUTHORIZED` | `401 Unauthorized` | Missing, malformed, or expired JWT bearer token. | Expired session, missing `Authorization: Bearer` header. | Redirect to login or initiate JWT refresh token exchange. |
| `FORBIDDEN` | `403 Forbidden` | Authenticated user lacks the required platform role or tenant access. | Learner attempting to access organizer admin settings; cross-tenant access attempt. | Display access-denied screen or disable forbidden UI actions. |
| `RESOURCE_NOT_FOUND` | `404 Not Found` | The requested entity identifier does not exist. | Querying a non-existent course ID or deleted user record. | Render 404 Not Found view or inform user resource was removed. |
| `CONFLICT` | `409 Conflict` | Operation conflicts with current platform state. | Duplicate email registration, concurrent mutation on same resource version. | Prompt user to resolve conflict or retry with updated state. |
| `RATE_LIMITED` | `429 Too Many Requests` | Request rate limit exceeded for client, IP, or organization. | Exceeding API gateway rate limits or brute-force throttling. | Backoff and retry after `Retry-After` duration. |
| `INTERNAL_ERROR` | `500 Internal Server Error` | Unhandled runtime exception or platform failure. | Database connection failure, unhandled runtime exception. | Display generic error modal with `correlationId` for support ticket. |
| `SERVICE_UNAVAILABLE` | `503 Service Unavailable` | Downstream dependency, database, or circuit breaker is open. | Service maintenance window or temporary outage. | Display maintenance page; client retries with exponential backoff. |

---

## 3. Example Error Payloads

### 3.1 Field Validation Error (`INVALID_INPUT`)
```json
{
  "success": false,
  "data": null,
  "meta": null,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Request payload validation failed.",
    "details": [
      {
        "field": "organizationId",
        "issue": "Must be a non-empty string starting with 'org_'."
      },
      {
        "field": "role",
        "issue": "Must be one of [ADMIN, ORGANIZER, INSTRUCTOR, LEARNER]."
      }
    ],
    "correlationId": "c7a31b20-1e82-4f11-9a70-8b77a942001e"
  },
  "timestamp": "2026-09-12T10:00:00.000Z"
}
```

### 3.2 Authorization Failure (`FORBIDDEN`)
```json
{
  "success": false,
  "data": null,
  "meta": null,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied. Required role: ORGANIZER.",
    "details": null,
    "correlationId": "f4a82b10-2e91-4c33-8a90-1c55a842002f"
  },
  "timestamp": "2026-09-12T10:00:00.000Z"
}
```
