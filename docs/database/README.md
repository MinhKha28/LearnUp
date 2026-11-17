# Database references

Each service owns its PostgreSQL schema and migrations. Use [shared conventions](conventions.md) for patterns across services. Update the reference in the same PR as the migration.

| Owner | Database | Reference |
| --- | --- | --- |
| Identity | `identity_db` | [Credentials and authentication](identity-db.md) |
| Notification | `notification_db` | [Notification delivery](notification-db.md) |
| Audit | `audit_db` | [Audit trail](audit-db.md) |
| Tenant | `tenant_db` | [Organizations, accounts and subscriptions](tenant-db.md) |
| Course | `course_db` | [Course versions and content](course-db.md) |
| Learning | `learning_db` | [Enrollments and progress](learning-db.md) |
| Assessment | `assessment_db` | [Assessment, scoring and review](assessment-db.md) |
| Achievement & Reporting | `achievement_reporting_db` | [Certificates, evaluations and reports](achievement-reporting-db.md) |
