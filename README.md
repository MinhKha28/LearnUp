# LearnUP

LearnUP is an organizational training platform. Organizations manage members,
subscriptions, Courses and Assessments; Learners track progress and receive
Certificates. The frontend communicates through the API Gateway, while services
own their data and integrate through HTTP APIs and Kafka events.

## Repository map

| Component | Location | Responsibility |
| --- | --- | --- |
| Frontend | [frontend/](frontend/README.md) | React, TypeScript and Vite role interfaces |
| Gateway | [gateway/api-gateway/](gateway/api-gateway/README.md) | Routing and authenticated request context |
| Identity | [services/identity-service/](services/identity-service/README.md) | Credentials and authentication |
| Notification | [services/notification-service/](services/notification-service/README.md) | Email and in-app message delivery |
| Audit | [services/audit-service/](services/audit-service/README.md) | Audit records |
| Tenant | [services/tenant-service/](services/tenant-service/README.md) | Canonical accounts, Organizations, subscriptions and payments |
| Course | [services/course-service/](services/course-service/README.md) | Course versions, curriculum and materials |
| Learning | [services/learning-service/](services/learning-service/README.md) | Enrollments, progress and completion |
| Assessment | [services/assessment-service/](services/assessment-service/README.md) | Quizzes, submissions, grading and peer reviews |
| Achievement & Reporting | [services/achievement-reporting-service/](services/achievement-reporting-service/README.md) | Certificates and reporting |
| Shared libraries | [java-common](libraries/java-common/README.md), [ts-common](libraries/ts-common/README.md), [ts-storage](libraries/ts-storage/README.md) | Technical utilities, shared types and storage providers |
| Infrastructure | [Eureka](infrastructure/eureka-server/README.md), [Kafka](infrastructure/kafka/README.md), infrastructure/postgres/ | Discovery, messaging and database initialization |

The Gateway, supporting services and Eureka use Java/Spring. The five business
services use NestJS/TypeScript with Prisma. Each of the eight services owns its
logical PostgreSQL database; consumers use APIs/events rather than another service's
tables. The [Compose file](docker-compose.yml) records the local topology and port
bindings. Frontend source and its package manifest are directly under frontend/.

## Development entry points

Use Java 21 and Maven for Java components, and Node 22/npm for the current JavaScript
CI environment. Each component has its own POM or package.json; there is no root npm
package. Start with the component README for private configuration and integration
prerequisites. Do not copy deployment credentials from examples or test fixtures.

For the frontend, from frontend/:

```sh
npm ci
npm run dev
```

Configure the frontend variables described in its README to point at the Gateway.
The default Compose Gateway URL is http://localhost:8088; standalone configuration
can use another port. Backend credentials must never be bundled into browser code.
Browser verification has separate opt-in prerequisites from unit tests.

For a TypeScript service, first install/build its file-linked libraries from each
library directory with npm ci and npm run build. Then, from the service directory:

```sh
npm ci
npx prisma generate --config prisma7.config.ts
npm run build
```

Provide the service's private environment and database configuration before running
its documented startup or integration procedure. Prisma generation does not apply
database migrations. Follow the owning service's migration instructions against the
intended isolated development database.

For Java components that depend on it, first run mvn install from
libraries/java-common/. From the component directory, use mvn test or mvn clean verify.
The Identity [development guide](services/identity-service/DEVELOPMENT.md) separates
default H2 tests from opt-in PostgreSQL and SMTP verification.

For the full local topology, read docker-compose.yml and the relevant service
configuration guides before starting containers. Supply required private environment
values, then validate with docker compose config --quiet; avoid printing rendered
configuration into shared logs. Identity has no published host port. A valid Compose
configuration is not proof that dependencies or all service integrations are healthy.

## Verification

[CI](.github/workflows/ci.yml) selects affected packages and records blocking versus
advisory checks. Run commands from their component directories:

| Part | Build / checks |
| --- | --- |
| Frontend | npm run build; npm run typecheck; npm test; npm run lint |
| TypeScript libraries | npm run build; npm run typecheck; npm test |
| Learning, Tenant, Assessment, Achievement | npm run build; npm run test:unit; service-specific integration suites |
| Course | npm run build; npm test -- --ci; separate E2E/database suites |
| Java services, Gateway, Eureka | mvn test; mvn clean verify |

Backend lint scripts commonly include --fix; use the nonmutating ESLint invocation
from CI for a check. Shared-library contract changes require fresh library builds
and verification of every consumer. Skipped browser/database tests, mocked Tenant
access and advisory checks must be reported accurately. Consult the component
README and manifest rather than treating this table as every suite's prerequisites.

## Contracts and architecture

- [Business source documents](docs/source-of-truth/) define business requirements.
- [OpenAPI contracts](contracts/openapi/README.md) and [event contracts](contracts/events/README.md) describe checked-in wire contracts.
- [Database references](docs/database/README.md) describe ownership and physical models.
- [Architecture decisions](docs/adr/) explain system choices; current manifests and configuration establish implemented wiring.
- [Contribution guidance](CONTRIBUTING.md) covers database and contract review.

The authentication boundary includes Gateway JWT verification and authenticated
private service channels. See [Identity](services/identity-service/README.md) and
[Gateway](gateway/api-gateway/README.md) for current behavior. Raw user/role headers
are not a substitute for authenticated context. Product technology exclusions are
recorded in the [technology ADR](docs/adr/0007-technology-exclusions.md).

## AI tools

Shared standards, personal instruction files and migration steps are documented in the
[AI assistant setup guide](docs/guides/ai-assistant-setup.md). Use it to configure your
tool and verify instruction loading and commit-policy checks.
