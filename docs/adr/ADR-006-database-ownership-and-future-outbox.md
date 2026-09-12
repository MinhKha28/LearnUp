# ADR-006: Database-per-Service & Future Transactional Outbox Pattern

## Status
Accepted

## Context
Sharing databases between microservices creates tight schema coupling, hidden transactional dependencies, and inhibits independent deployments. Simultaneously, dual-write scenarios (writing to a database and publishing to Kafka) can lead to data inconsistency if one operation fails.

## Decision
1. **Strict Database-per-Service**: Each microservice owns its private PostgreSQL database or isolated schema. Direct cross-database access is prohibited.
2. **Logical Tenant Partitioning**: Multi-tenancy is enforced in P0 via `organization_id` columns and application-level filters.
3. **Future Outbox Pattern**: In future service implementation phases, the Transactional Outbox pattern will be adopted for business events to guarantee atomic local database writes and reliable at-least-once Kafka publishing. (No Outbox code in P0).

## Consequences
- **Positive**: Complete domain independence, modular scalability, and a documented architectural path for event reliability.
- **Negative**: Cross-service queries require API calls or asynchronous read-model projections.
