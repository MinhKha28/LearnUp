# ADR-007: Standard API Response & Error Envelope Format

## Status
Accepted

## Context
A heterogeneous polyglot microservice backend (Spring Boot & NestJS) serving a Next.js frontend needs consistent response structures so that client-side networking layers, error interceptors, and pagination controls can operate uniformly.

## Decision
1. All REST endpoints must return a standardized JSON structure:
   - Success responses wrapped in `ApiResponse<T>` with `success`, `data`, `meta`, `error: null`, and `timestamp`.
   - Error responses wrapped in `ApiResponse<T>` (or `ApiError`) with `success: false`, `data: null`, `meta: null`, and structured `error` object (`code`, `message`, `details`, `correlationId`).
2. Standard error code taxonomy (`INVALID_INPUT`, `UNAUTHORIZED`, `FORBIDDEN`, `RESOURCE_NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`) is enforced.
3. Standard offset/page-based pagination (`page`, `size`, `totalElements`, `totalPages`, `hasNext`, `hasPrevious`) is used for MVP.

## Consequences
- **Positive**: Uniform client-side error handling and response unwrapping across the entire platform.
- **Negative**: Adds a standard outer wrapping layer around single-item payload responses.
