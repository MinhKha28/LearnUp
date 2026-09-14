# TypeScript Common Library (`libraries/ts-common`)

Framework-neutral shared TypeScript utilities for ReactJS frontend and NestJS microservices.

## Modules & Utilities
* **Types**: Standard `ApiResponse<T>`, `ApiError`, `PageResponse<T>`, `UserRole` (`'ADMIN' | 'ORGANIZER' | 'INSTRUCTOR' | 'LEARNER'`).
* **Context**: `UserContext`, `OrganizationContext`.
* **HTTP & Headers**: Header constants (`X-User-ID`, `X-Organization-ID`, `X-User-Role`, `X-Correlation-ID`), Axios interceptor helpers.
* **Event Envelope**: TypeScript interfaces for the canonical Kafka event envelope.

## Strict Rule
* The core package must remain framework-neutral (usable in both ReactJS client and NestJS backend).
