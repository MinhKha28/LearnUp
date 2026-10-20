# LearnUP source and notation reference

## Targeted source discovery

Resolve paths from the repository root. Start with the requested UC description, then search relevant names or endpoints with `rg`.

| Concern | Starting points |
| --- | --- |
| UI and navigation | `frontend/src/router.tsx`, relevant `frontend/src/pages/` and `frontend/src/components/` files |
| Browser API calls | `frontend/src/services/`, including `api.client.ts` and `auth.session.ts` only when relevant |
| Public routing | `gateway/api-gateway/src/main/resources/application.yml` |
| NestJS implementation | `services/<service>/src/modules/`, `src/infrastructure/clients/`, `src/main.ts`, `src/app.setup.ts` for prefixes |
| Prisma persistence | Actual repository and `services/<service>/prisma/schema.prisma` |
| Spring implementation | `services/<service>/src/main/java/com/learnup/`, relevant controller, service, client, repository, domain |
| Spring persistence | Relevant entity and `src/main/resources/db/migration/` |
| Contracts and architecture | Relevant files in `contracts/openapi/`, `contracts/events/`, `docs/architecture/`, `docs/business/` |
| Runtime wiring | Relevant module/configuration and `docker-compose.yml` when needed to establish whether an integration executes |

Check both the client URL and backend prefix; a controller decorator alone is not the full public path. For example, the current browser client defines `/api/v1/enrollments`, while the NestJS controller declares `enrollments`; resolve the prefix from bootstrap and gateway configuration.

Avoid assuming a class exists merely because another service has that layer. NestJS services can use Prisma directly or through repositories. Spring services use their own implemented repository/domain classes. A generated Prisma record does not execute a database call.

## Display conventions

Do not add a rendered `title`. Identify the UC through its `[UC_CODE]_SequenceDiagram.puml` filename; optionally preserve the code and name in a non-rendering comment such as `' UC14 - View Managed Courses`. The validator accepts diagrams without UC comments and does not require a title.

Do not render note boxes. Put preconditions, source references, environment details, known implementation gaps, and longer explanations in apostrophe comments or the response. This applies to `note`, `hnote`, and `rnote` syntax.

Keep source paths in comments and source summaries. Use readable screen names without a component filename or path suffix: UC14 uses `View Course Page`, and UC14.2 uses `Create Course Page`. Declare the gateway as `participant ":ApiGateway" as Gateway`.

Declare every non-database participant first, including downstream clients/controllers/services, storage providers, external systems, and Kafka. Declare all service-owned databases last; this places their lifelines at the far right. For UC14, `course_db` and `learning_db` both follow `EnrollmentsService`. For UC14.2, `course_db` follows `Cloudinary`.

Use `autonumber "<b>0.</b> "` to produce a bold number with a period and trailing space. Keep message text unnumbered. A forwarded HTTP message can read `GET /api/v1/courses\nTrusted userId, organizationId, role`; omit `no path rewrite` when the path is unchanged. Preserve an actual path transformation when it is relevant.

Keep each arrow to one action/result and one or two explicit lines. Prefer `Count InProgress learners by course\nCurrent organization` over a three-line Prisma predicate, and `Save Draft Course` over a long method call with every argument. Exact endpoints remain visible. Framework defaults, field-by-field mappings, localhost URLs, and full error explanations belong in comments. UC11 is a reference for short labels, not a source of LearnUP domain behavior.

Each `alt` and `else` label states a result containing `successfully` or `failed`. Valid examples include `Courses loaded successfully - courses found`, `Courses loaded successfully - empty list`, and `Course loading failed`. Multiple successful alternatives are permitted when both are valid outcomes. Optional cover selection uses `opt A cover is selected`; absence of a cover is not a failure.

## Service ownership

Use this map to locate code, then verify the exact model names and behavior in that service:

| Service directory | Owned database | Domain |
| --- | --- | --- |
| `identity-service` | `identity_db` | Credentials, authentication, tokens |
| `tenant-service` | `tenant_db` | Accounts, organizations, memberships, tags, subscriptions, payments |
| `course-service` | `course_db` | Courses, versions, modules, lessons, materials |
| `learning-service` | `learning_db` | Enrollments, assignments, learning progress |
| `assessment-service` | `assessment_db` | Questions, submissions, grading, peer reviews |
| `achievement-reporting-service` | `achievement_reporting_db` | Certificates, analytics, compliance reports |
| `notification-service` | `notification_db` | Notifications and email delivery |
| `audit-service` | `audit_db` | Audit records |

LearnUP's authenticated roles are `ADMIN`, `ORGANIZER`, `INSTRUCTOR`, and `LEARNER`; use Guest for an unauthenticated public interaction when applicable. Use the source-supported actor for the requested UC, including a scheduler or external callback where appropriate.

Architecture documentation describes intended REST/Kafka patterns, but may lag implementation (including outbox-related code). Event schemas or examples do not prove an active producer or consumer. Check actual call sites and wiring; disclose gaps. Do not replace an implemented REST call with a speculative Kafka exchange.

## Activation through alternative paths

These fragments are illustrative. In a complete diagram, declare every alias before use and supply the required header.

Preferred convergence, with a single closing activation:

```plantuml
Screen -> EnrollmentsController: POST /api/v1/enrollments
activate EnrollmentsController
EnrollmentsController -> EnrollmentsService: Check enrollment eligibility
activate EnrollmentsService
alt Enrollment eligibility checked successfully
  EnrollmentsService -> EnrollmentRepository: Save enrollment
  activate EnrollmentRepository
  EnrollmentRepository -->> EnrollmentsService: Enrollment saved
  deactivate EnrollmentRepository
else Enrollment eligibility check failed - already enrolled
  EnrollmentsService -> EnrollmentsService: Prepare conflict result
end
EnrollmentsService -->> EnrollmentsController: Enrollment outcome
deactivate EnrollmentsService
EnrollmentsController -->> Screen: Success or conflict response
deactivate EnrollmentsController
```

Separate closing returns in exhaustive branches are also valid. Both operands begin with the incoming activation depth; they are alternatives rather than sequential executions:

```plantuml
Screen -> EnrollmentsController: Submit enrollment
activate EnrollmentsController
alt Enrollment created successfully
  EnrollmentsController -->> Screen: 201 Created
  deactivate EnrollmentsController
else Enrollment creation failed
  EnrollmentsController -->> Screen: Business error
  deactivate EnrollmentsController
end
```

For `alt` without `else`, the implicit skipped branch preserves the incoming activations. Do not close an incoming activation only in that optional success path. Keep activations balanced locally inside `opt`, `loop`, and each `par` operand. Avoid `return`, `break`, activation shorthand, and unsupported fragment types in the static validator's supported subset; express the same outcomes with explicit arrows and exhaustive alternatives where semantically equivalent.

## Asynchronous event semantics

Use this shape only when actual producer and consumer implementations support the exchange. The generic aliases and labels below do not define LearnUP topics or class names:

```plantuml
Producer ->> Kafka: Publish implemented domain event
activate Kafka
Kafka -->> Producer: Broker acknowledgement
deactivate Kafka
Producer -->> Controller: Command accepted
deactivate Producer
... Later, independently of the HTTP response ...
Kafka ->> Consumer: Deliver domain event
activate Consumer
Consumer -> ConsumerDB: Persist derived outcome
activate ConsumerDB
ConsumerDB -->> Consumer: Saved
deactivate ConsumerDB
deactivate Consumer
```

The broker acknowledgement is an acknowledgement of event publication, not a downstream business result. An event consumer may complete after the user's response. Do not fabricate ordering between independent consumers; use `par` only if actual concurrency is relevant and supported.
