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

Declare every non-database participant first, including downstream controllers/services, storage providers, external systems, and Kafka. Declare all service-owned databases last; this places their lifelines at the far right. For UC14, `course_db` and `learning_db` both follow `EnrollmentsService`. For UC14.2, `course_db` follows `Cloudinary`.

Use `autonumber "<b>0.</b> "` to produce a bold number with a period and trailing space. Keep message text unnumbered. A forwarded HTTP message can read `GET /api/v1/courses\nTrusted userId, organizationId, role`; omit `no path rewrite` when the path is unchanged. Preserve an actual path transformation when it is relevant.

Keep each arrow to one action/result and one or two explicit lines. Prefer `Count InProgress learners by course\nCurrent organization` over a three-line Prisma predicate, and `Save Draft Course` over a long method call with every argument. Exact endpoints remain visible. Framework defaults, field-by-field mappings, localhost URLs, and full error explanations belong in comments. UC11 is a reference for short labels, not a source of LearnUP domain behavior.

Each `alt` and `else` label states a result containing `successfully` or `failed`. Valid examples include `Courses loaded successfully - courses found`, `Courses loaded successfully - empty list`, and `Course loading failed`. Multiple successful alternatives are permitted when both are valid outcomes. Use `opt` only when an optional body's skipped path and completed path can share the continuation. For UC14.2 keep optional upload in `opt Cover selected`, then guard the common create operation with `alt Cover prepared successfully`. No cover and a successful upload both proceed; a failed upload or missing response data stops. Absence of a cover is not a failure.

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

## Fragment hierarchy and compact layout

Use an actual initial guard as one outer `alt`: Instructor access for UC14, and form validation for UC14.2. Keep dependent work, DB processing and user outcomes inside it. Nest dependent outcome handling where useful; stages may converge within the outer operand when a later guard explicitly checks that continuation is allowed. Native `alt/else/end` and `opt/end` provide the frame structure.

UC14 follows access success -> courses found -> learner-count REST success -> display courses. Empty-list success returns without REST; a REST failure returns 503 and displays the error. Hide LearningClient/TenantClient adapters: draw `CoursesService -> EnrollmentsController` with the real endpoint. Their source remains evidence for trusted headers and timeout/error mapping. Do not imply a successful downstream DB call or a response after a timeout.

UC14.2 has four main alternatives: form validation, cover upload outcome, cover readiness and Course creation outcome. The cover upload is optional. Its successful trace shows storage and metadata persistence; its failed operand groups technical upload failures, with optional best-effort image cleanup only when storing the image succeeded but metadata persistence failed. After upload processing converges, the readiness guard admits either no selected cover or a valid upload response. Failed upload cannot reach creation. Draw the shared create operation once; keep Instructor/organization access checks, the atomic CourseChain/Course transaction, success navigation and grouped creation errors. Later creation failure does not clean up an already committed cover.

Outcome-labelled alternatives summarize operation traces, not executable future checks added to the code. An operation-entry call may precede an outcome alternative whose successful operand expands its internals. When failure internals are summarized, comments must identify omitted validation/provider/DB attempts rather than drawing those steps as successful on every failure path. Source evidence and cleanup preconditions still apply.

Frame widths follow contained participants. Keep related conditions under the outer frame, without inventing guards, duplicating shared operations or adding an `alt` for every implementation check solely to force a shrinking pyramid. Independent phases and a converged optional preparation may be sequential inside that frame; semantic readiness still needs source review. A standalone optional interaction may use `opt` without an invented outer alternative.

Use short plain guard labels, at most two explicit lines with `\n`. Do not use `<space:...>`, custom `group ... alt` headers, invisible characters or markup to force label placement. Draw.io can display these literally despite a successful local PlantUML render. Preserve all required activation bars and keep the font readable. Source indentation does not control frame geometry. Check the actual target importer when accessible; an older local renderer is an additional check, not proof of draw.io import.

Keep native vertical spacing and `MaxMessageSize 200` for message wrapping without reducing font size. Remove redundant mapping/forwarding and repeated bookkeeping self-calls; group technical errors with the same UI outcome, preserving business-critical decisions, DB ownership and compensation. Keep actor activation from its first action and screen activation from entry through the final user outcome. UI self-calls open and close only a nested child. The obsolete ParticipantPadding header remains omitted to avoid warning banners. Review lower branches and the complete image; tall PNGs may require `-DPLANTUML_LIMIT_SIZE=12000` before `-jar`, or inspect SVG to avoid silent bottom cropping.

## Activation examples

These fragments are illustrative. In a complete diagram, declare every alias, supply the required header, and activate the caller, actor and screen before the fragment begins where relevant.

A synchronous self-call needs a child execution on the same already-active lifeline. The inner `deactivate` closes only the child; the outer activation stays open for subsequent work:

```plantuml
Controller -> Service: Load managed courses
activate Service
Service -> Service: Verify instructor access
activate Service
deactivate Service
Service -> Repository: Load assigned courses
activate Repository
Repository -->> Service: Course list
deactivate Repository
Service -->> Controller: Course list
deactivate Service
```

For a self-call that contains downstream calls, move its child `deactivate` after those calls finish. Recursive self-calls may reach depth three or higher; close each level in order. Maintain the same activation depth at every `alt/else` merge and preserve the parent on each path. Do not end/restart the parent to fake nesting. Comments and blank lines are allowed between the self-message and its `activate`; another executable statement is not. A self-return or asynchronous self-message does not itself require this synchronous nesting pattern.

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
  activate EnrollmentsService
  deactivate EnrollmentsService
end
EnrollmentsService -->> EnrollmentsController: Enrollment outcome
deactivate EnrollmentsService
EnrollmentsController -->> Screen: Success or conflict response
deactivate EnrollmentsController
```

Separate closing returns in exhaustive branches need explicit restoration. The logical operands share the incoming activation depth, but PlantUML renders the lines sequentially. Reopen the execution closed in the prior operand at the start of `else`; do not add another activation to callers that are still active:

```plantuml
Screen -> EnrollmentsController: Submit enrollment
activate EnrollmentsController
alt Enrollment created successfully
  EnrollmentsController -->> Screen: 201 Created
  deactivate EnrollmentsController
else Enrollment creation failed
  ' Restore the same incoming execution for this alternative.
  activate EnrollmentsController
  EnrollmentsController -->> Screen: Business error
  deactivate EnrollmentsController
end
```

For multiple incoming callers, restore every missing level (for example Gateway, Controller and Service) before the next operand's first arrow, then close them after their respective replies. Leave continuous actor/screen bars alone. For a self-call whose child closes in each alternative, restore that missing child level as well. The validator separately tracks logical path depths and source-order render depths, consumes only the necessary initial branch activations as restoration, and rejects work that starts before restoration is complete. A plain count or a logical branch-balance pass cannot detect missing bars in the lower half of a render.

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
