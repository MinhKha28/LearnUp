# Database Ownership & Data Isolation Strategy

A core tenet of the LearnUP architecture is the strict implementation of the **Database-per-Service** pattern. Each microservice maintains complete encapsulation over its persistent data.

---

## 1. Database Allocation

Every microservice connects exclusively to its own dedicated PostgreSQL database.

```text
┌─────────────────────────────────────┬──────────────────────────────┬────────────────────────────────────────┐
│ Service                             │ Database Name                │ Primary Entities                       │
├─────────────────────────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ Identity Service                    │ identity_db                  │ Credentials, RefreshToken, LoginAudit  │
│ Tenant Service                      │ tenant_db                    │ UserAccount, Org, Member, Plan, Sub    │
│ Course Service                      │ course_db                    │ Course, CourseVersion, Module, Lesson  │
│ Learning Service                    │ learning_db                  │ Enrollment, Progress, Assignment       │
│ Assessment Service                  │ assessment_db                │ Quiz, Question, Attempt, Submission    │
│ Achievement & Reporting Service     │ achievement_reporting_db     │ Certificate, Evaluation, Report        │
│ Notification Service                │ notification_db              │ Notification, Template, EmailLog       │
│ Audit Service                       │ audit_db                     │ AuditLog                               │
└─────────────────────────────────────┴──────────────────────────────┴────────────────────────────────────────┘
```

---

## 2. Strict Data Isolation Rules

### 2.1 No Direct Cross-Database Access
* Services are strictly prohibited from connecting to, reading from, or writing to another service's database.
* Database user credentials for each service only have access rights to that service's database.

### 2.2 No Cross-Database Foreign Keys
* Relational foreign key constraints (`REFERENCES other_db.table`) across service boundaries do **NOT** exist.
* Database integrity is maintained strictly within each bounded context.

### 2.3 Logical References Only
* Services store references to external domain entities purely as scalar opaque identifiers:
  * `organizationId: UUID`
  * `userId: UUID`
  * `courseId: UUID`
  * `learnerId: UUID`
  * `instructorId: UUID`
  * `assessmentId: UUID`
* When a service needs descriptive information about a referenced ID, it calls the owning service via REST or receives cached state through domain events.

```text
Example in Learning Service:
┌──────────────────────────────────────────────┐
│ Table: required_course_assignments           │
├──────────────────────────────────────────────┤
│ id                 UUID PRIMARY KEY          │
│ organization_id    UUID NOT NULL (Scalar)    │  <-- Logical reference to Org Service
│ course_id          UUID NOT NULL (Scalar)    │  <-- Logical reference to Course Service
│ learner_id         UUID NOT NULL (Scalar)    │  <-- Logical reference to Org Service
│ due_date           TIMESTAMP WITH TIME ZONE  │
│ status             VARCHAR(30)               │
└──────────────────────────────────────────────┘
```

---

## 3. Schema Evolution & Migrations

* **Spring Boot Services**: Use **Flyway** (`src/main/resources/db/migration/V1__initial_schema.sql`).
* **NestJS Services**: Use framework-standard migrations (e.g. TypeORM / Prisma / Knex).
* All schema changes are tracked in source control and applied automatically on container startup.
* Migration scripts must be backward-compatible and deterministic.
