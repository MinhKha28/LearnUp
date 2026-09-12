# ADR-005: JWT Authentication, Allowed Roles & Gateway Header Propagation

## Status
Accepted

## Context
Downstream microservices need authenticated caller identity (`userId`), tenant scope (`organizationId`), and roles without re-verifying JWT signatures or querying an identity database on every internal request. Furthermore, malicious clients must not be able to spoof headers.

## Decision
1. **Client Authentication**: Clients authenticate at the edge using `Authorization: Bearer <JWT>`.
2. **Canonical Roles**: Platform roles are strictly standardized to: `ADMIN`, `ORGANIZER`, `INSTRUCTOR`, `LEARNER`.
3. **Gateway Anti-Spoofing & Header Stripping**:
   - The Spring Cloud Gateway **MUST overwrite or remove any client-supplied `X-User-ID` or `X-Organization-ID` headers**.
4. **Gateway Claims Extraction**:
   - The Gateway validates the JWT token signature and expiration.
   - It extracts the `sub` claim and injects `X-User-ID`.
   - It extracts the `organizationId` claim and injects `X-Organization-ID`.
5. **Correlation ID**:
   - The Gateway preserves client-provided `X-Correlation-ID` or generates a new UUID if omitted, then forwards it downstream.
6. **Internal Trust**:
   - Internal microservices trust `X-User-ID` and `X-Organization-ID` because direct public ingress bypass is prohibited.

## Consequences
- **Positive**: Eliminates redundant cryptographic JWT parsing in every downstream service; prevents tenant and identity spoofing attacks.
- **Negative**: Internal services depend on the Gateway for security header guarantees.
