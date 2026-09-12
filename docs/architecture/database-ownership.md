# Database Ownership & Multi-Tenancy Data Architecture

## 1. Database-per-Service Principle

LearnUP enforces a strict **Database-per-Service** architectural pattern:

1. **Zero Shared Databases**:
   - Each microservice owns its private PostgreSQL database or isolated schema.
   - No microservice may connect to, read from, or write to another service's database directly.
2. **Encapsulated Schema Evolution**:
   - Schema migrations (e.g. via Flyway or Liquibase in Spring Boot; Prisma/TypeORM migrations in NestJS) are owned independently by the respective service repository.
3. **Data Sharing via APIs and Events Only**:
   - When Service A requires information owned by Service B, it must either:
     - Query Service B's public REST endpoint via HTTP, or
     - Maintain an asynchronous local read model populated by subscribing to Service B's Kafka events.

---

## 2. Multi-Tenancy Data Isolation Model

LearnUP is an enterprise B2B platform where multiple corporate organizations share platform resources while requiring strict data isolation.

### 2.1 Standardized Identifier: `organizationId`
- All multi-tenant tables MUST include an `organization_id` column as a mandatory non-nullable foreign key or discriminator.
- Every repository query, insert, update, and delete operation MUST enforce `organization_id` filtering derived from the authenticated execution context (`X-Organization-ID`).

### 2.2 Logical Isolation vs Future Physical Isolation
In the initial architecture baseline, multi-tenancy is implemented through **Logical Tenant Partitioning (Discriminator Column)**:
- All tenant rows reside within the service's database tables, explicitly partitioned and indexed by `organization_id`.
- Composite primary/unique keys and composite indexes MUST lead with or include `organization_id` (e.g., `(organization_id, resource_id)`).

```sql
-- Standard Multi-Tenant Table Architecture Pattern
CREATE TABLE example_resource (
    id VARCHAR(36) NOT NULL,
    organization_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_example_resource PRIMARY KEY (id),
    CONSTRAINT idx_example_resource_org UNIQUE (organization_id, id)
);

CREATE INDEX idx_example_resource_org_name ON example_resource(organization_id, name);
```

### 2.3 Row-Level Security (RLS) as a Future Option
- **PostgreSQL Row-Level Security (RLS)** is recognized and documented as an advanced architectural option for enforcing database-level tenant isolation.
- *Status in P0*: RLS is not implemented in P0. Tenant filtering is enforced at the application data access layer using `OrganizationContext` and `TenantSecurityFilter`. RLS remains an architectural upgrade path for high-compliance enterprise tiers.

---

## 3. Transaction Boundaries & Eventual Consistency

1. **Single-Service ACID Transactions**:
   - Transactions must remain strictly local to a single microservice and its own database.
   - Distributed 2-Phase Commit (2PC) or XA transactions across multiple services are strictly prohibited.
2. **Cross-Service Eventual Consistency**:
   - Multi-step business workflows spanning across boundaries (e.g. User Registration -> Seat Allocation -> Welcome Email) must use **Event-Driven Choreography** or the **Saga Pattern**.
3. **Future Reliability Pattern: Transactional Outbox**:
   - To avoid dual-write race conditions (where a database commit succeeds but the Kafka publish fails), future services publishing critical domain events will persist outbound events to an `outbox` table in the same transaction as business data.
   - An asynchronous relay reads uncommitted outbox entries and delivers them reliably to Kafka with at-least-once guarantees.
