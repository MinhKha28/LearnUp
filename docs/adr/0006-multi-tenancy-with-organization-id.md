# ADR 0006: Multi-Tenancy Isolation with Canonical organizationId

## Status
Accepted

## Context
LearnUP is a B2B platform where multiple enterprise organizations share the platform while their data must remain strictly isolated. Inconsistent naming conventions (e.g. mixing `tenantId` and `organizationId`) or trusting frontend tenant parameters creates severe security vulnerabilities and confusion.

## Decision
1. **Single Canonical Identifier**: `organizationId` is the sole tenant identifier across all schemas, APIs, JWT claims, headers, and events. The term `tenantId` is prohibited.
2. **Backend Enforcement**: Organization context is extracted from trusted Gateway headers (`X-Organization-ID`) or verified via database lookups. Frontend state is never trusted.
3. **Data Scoping**: Every tenant-aware table includes `organization_id` as a column and all queries filter by `organization_id`.

## Consequences
### Positive:
* Consistent terminology across all codebase modules and documentation.
* Strong multi-tenant security boundary.
