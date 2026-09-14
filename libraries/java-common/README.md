# Java Common Library (`libraries/java-common`)

Minimal shared technical library for Spring Boot microservices in the LearnUP platform.

## Modules & Utilities
* **Security & Context**: `CurrentUser`, `OrganizationContext`, `RoleEnum` (`ADMIN`, `ORGANIZER`, `INSTRUCTOR`, `LEARNER`), `UserContextFilter`.
* **Standard Response**: `ApiResponse<T>`, `ApiError`, `PageResponse<T>`.
* **Exceptions**: `BusinessException`, `ResourceNotFoundException`, `UnauthorizedException`, `GlobalExceptionHandler`.
* **Correlation**: `CorrelationIdFilter`, `CorrelationIdHolder`.
* **Event Envelope**: `EventEnvelope<T>` matching `contracts/events/event-envelope.schema.json`.

## Strict Rule
* No business entities, JPA repositories, or domain services are allowed in this library. It contains technical utilities only.
