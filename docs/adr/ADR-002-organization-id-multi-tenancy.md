# ADR-002: Standardization on organizationId for Multi-Tenancy

## Status
Accepted

## Context
In B2B multi-tenant applications, using ambiguous or multiple tenant identifiers (e.g., mixing `tenantId`, `orgId`, `organizationId`, `companyId`) causes confusion in API contracts, database schemas, and event messages.

## Decision
1. Standardize exclusively on `organizationId` across all contracts, codebases, database tables, JWT claims, Kafka events, and HTTP headers (`X-Organization-ID`).
2. Do not introduce dual naming (`tenantId` + `organizationId`).
3. Enforce tenant data isolation logically in P0 via `organization_id` database columns and application-layer filters. Document PostgreSQL Row-Level Security (RLS) as a future architecture option without implementing it in P0.

## Consequences
- **Positive**: Single, unambiguous naming convention across frontend, backend, databases, and message brokers.
- **Negative**: Requires strict naming hygiene when modeling external integrations.
