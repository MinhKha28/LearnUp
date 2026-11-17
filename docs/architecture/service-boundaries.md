# Service boundaries

| Service | Framework | Owns |
| --- | --- | --- |
| Identity | Spring Boot | Credentials, password recovery, login throttling, access and refresh tokens |
| Notification | Spring Boot | In-app notifications, email delivery and delivery ledgers |
| Audit | Spring Boot | Append-only audit records, actor and target references, organization scope and correlation |
| Tenant | NestJS | Canonical users, Organizations, membership, invitations, plans, subscriptions and payments |
| Course | NestJS | Course chains, versions, syllabus, materials, media metadata and content reports |
| Learning | NestJS | Enrollment lifecycle, progress, course snapshots and course completion |
| Assessment | NestJS | Quizzes, assignments, submissions, scoring and peer review |
| Achievement & Reporting | NestJS | Certificates, signer settings, evaluation and report persistence |

Identity owns authentication. Tenant owns canonical accounts and member lifecycle. Services perform governance mutations in their own domains, and Audit owns the shared governance audit trail. The Gateway exposes audit reads and services submit audit writes directly. See the [Gateway routes](../../gateway/api-gateway/src/main/resources/application.yml) and [Audit service](../../services/audit-service/README.md).

Achievement & Reporting consumes enrollment completion events to issue certificates. The [certificate API](../../contracts/openapi/achievement-reporting-service.yaml) exposes learner-owned certificates and Organizer signer settings. Public certificate verification is not implemented.
