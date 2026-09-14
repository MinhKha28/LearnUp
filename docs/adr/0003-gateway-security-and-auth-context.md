# ADR 0003: API Gateway Security and Authentication Context Propagation

## Status
Accepted

## Context
Downstream microservices need user identity, organization context, and role information to enforce authorization and multi-tenant isolation. Having every microservice individually parse and validate JWT cryptographic signatures increases duplicate logic and overhead.

## Decision
1. Spring Cloud Gateway serves as the single ingress point and validates all JWT tokens.
2. The Gateway strips/sanitizes any client-provided `X-User-ID`, `X-Organization-ID`, `X-User-Role`, and `X-Correlation-ID` headers to prevent header spoofing.
3. Upon successful JWT cryptographic verification, the Gateway injects trusted HTTP headers into the downstream request:
   * `X-User-ID`
   * `X-Organization-ID`
   * `X-User-Role`
   * `X-Correlation-ID`
4. Downstream microservices trust these headers as verified authentication context and enforce role-based access control (RBAC) and tenant filtering accordingly.

## Consequences
### Positive:
* Centralized token verification and uniform correlation ID injection.
* Simple, framework-neutral consumption in downstream Spring Boot and NestJS services.
* Protection against header injection attacks.

### Negative:
* Downstream services rely on the Gateway for perimeter security; direct external access to internal service ports must be restricted.
