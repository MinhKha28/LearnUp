# ADR 0002: Database-per-Service Pattern

## Status
Accepted

## Context
In microservice architectures, shared databases create tight coupling, risk unintended cross-domain data dependencies, and prevent independent evolution of service schemas.

## Decision
Every microservice in LearnUP with persistent state owns a dedicated PostgreSQL logical database:
* `identity_db`, `media_db`, `audit_db`, `organization_commercial_db`, `course_db`, `learning_db`, `assessment_db`, `achievement_reporting_db`.

No service may directly connect to or query another service's database. Cross-service relationships are represented exclusively by scalar logical identifiers (`organizationId`, `userId`, `courseId`, etc.) without cross-database foreign keys.

## Consequences
### Positive:
* Complete data encapsulation and autonomous schema migrations per service.
* Clear business boundary enforcement.

### Negative:
* Cannot perform relational SQL `JOIN`s across services; data composition must occur via REST APIs or cached event projections.
