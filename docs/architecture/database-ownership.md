# Database ownership and migrations

Each of the eight services owns a logical PostgreSQL database. A service reads and writes its own tables. Cross-service queries use API contracts, and asynchronous consumers maintain their own data from event contracts. Cross-service references are identifiers; foreign keys and transactions stay within the owning database.

## Migration tools

| Services | Tool | Source |
| --- | --- | --- |
| Identity, Notification, Audit | Flyway | [Identity](../../services/identity-service/src/main/resources/db/migration), [Notification](../../services/notification-service/src/main/resources/db/migration), [Audit](../../services/audit-service/src/main/resources/db/migration) |
| Tenant, Course, Learning, Assessment, Achievement & Reporting | Prisma | [Tenant](../../services/tenant-service/prisma/migrations), [Course](../../services/course-service/prisma/migrations), [Learning](../../services/learning-service/prisma/migrations), [Assessment](../../services/assessment-service/prisma/migrations), [Achievement & Reporting](../../services/achievement-reporting-service/prisma/migrations) |

See the [database reference index](../database/README.md) for service ownership.
