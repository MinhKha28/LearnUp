# LearnUP Database Design Documentation

This directory contains the authoritative technical documentation, schema inventories, migration mappings, and Entity-Relationship Diagrams (ERDs) for the physical database schemas implemented in the LearnUP platform.

---

## 1. Documentation Scope

This documentation covers the **3 implemented Supporting Services databases**:

| Database | Owning Service | Technology | Documentation Link | ERD Diagram |
|:---|:---|:---|:---|:---|
| **`identity_db`** | `identity-service` | PostgreSQL 16 | [identity-db.md](file:///d:/Study/learnup/docs/database/identity-db.md) | [identity-db.mermaid](file:///d:/Study/learnup/docs/database/erd/identity-db.mermaid) |
| **`notification_db`** | `notification-service` | PostgreSQL 16 | [notification-db.md](file:///d:/Study/learnup/docs/database/notification-db.md) | [notification-db.mermaid](file:///d:/Study/learnup/docs/database/erd/notification-db.mermaid) |
| **`audit_db`** | `audit-service` | PostgreSQL 16 | [audit-db.md](file:///d:/Study/learnup/docs/database/audit-db.md) | [audit-db.mermaid](file:///d:/Study/learnup/docs/database/erd/audit-db.mermaid) |

For a cross-service comparison, see [supporting-services-database-design.md](file:///d:/Study/learnup/docs/database/supporting-services-database-design.md).

---

## 2. Distinction: Current Implementation vs. Target Architecture Ownership

> [!IMPORTANT]
> **Current Database Implementation**:
> - Reflects the physical tables, columns, indexes, constraints, and Flyway migrations that **actually exist** in the repository today.
> - Business services (tenant, course, learning, assessment, achievement-reporting) own their schemas via Prisma migrations under `services/<service>/prisma/`; this folder documents the supporting Java services (identity, notification, audit) plus the learning design.
>
> **Future Tenant / User Ownership Migration**:
> - In the current implementation, `identity_db.users` owns user credentials and authentication attributes.
> - In the finalized target architecture, canonical user and organization master data will be owned by `tenant-service` (`tenant_db`). This migration is deferred until `tenant-service` is implemented in NestJS.

---

## 3. Schema Verification Sources
All schemas documented in this directory have been verified against:
1. **Live PostgreSQL 16 Instance**: Inspected via PostgreSQL catalog queries (`information_schema.columns`, `information_schema.table_constraints`, `pg_indexes`).
2. **Flyway Migrations**: Inspected in `services/*/src/main/resources/db/migration/`.
3. **JPA Entity Definitions**: Inspected in active Spring Boot supporting service modules.

---

## 4. Directory Structure

```text
docs/database/
├── README.md                                    # This navigation file
├── supporting-services-database-design.md       # Consolidated overview of supporting databases
├── identity-db.md                               # Detailed schema specification for identity_db
├── notification-db.md                           # Detailed schema specification for notification_db
├── audit-db.md                                  # Detailed schema specification for audit_db
└── erd/
    ├── identity-db.mermaid                      # Mermaid ERD for identity_db
    ├── notification-db.mermaid                  # Mermaid ERD for notification_db
    └── audit-db.mermaid                         # Mermaid ERD for audit_db
```
