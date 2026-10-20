---
name: learnup-drawio-sequence-diagram
description: Create or revise source-backed LearnUP sequence diagrams in PlantUML for draw.io, including React screens, API Gateway, NestJS or Spring Boot services, service-owned databases, and implemented REST or Kafka interactions. Use for a LearnUP use case or sub-use case; exclude activity, class, ERD, deployment, and use-case diagrams.
---

# LearnUP Draw.io Sequence Diagrams

Create one business-level sequence diagram per requested LearnUP use case. Preserve the EventSphere skill's draw.io presentation conventions while following LearnUP's actual implementation. Read [references/learnup-conventions.md](references/learnup-conventions.md) for source locations, ownership, and notation before drafting.

## Scope and evidence

- Determine the requested UC code, name, actor, trigger, and outcome from the user's specification and relevant source. Support subcodes such as `UC25.3`; there is no UC01-UC26 limit. Ask only when the intended UC cannot be identified. Never invent a UC catalog.
- Default output: `docs/uml/sequence/[UC_CODE]_SequenceDiagram.puml`. Honor an explicit alternate location; the validator accepts any path and checks the UC filename convention.
- Follow the relevant React page and API call through gateway routing, controller, service, persistence, and directly involved downstream endpoints or event handlers. Use targeted searches; do not read unrelated modules.
- For diagrams of current behavior, implementation is evidence of what executes. Use specifications and contracts to explain intent; disclose conflicts rather than silently claiming that planned behavior exists. If a design for unimplemented behavior is explicitly requested, mark it as proposed and distinguish assumptions.
- Include the main success path and normally one or two consequential business failures. Preserve checks that determine eligibility, tenant boundaries, deadlines, enrollment status or other requested business outcomes. At business overview level, group technical validation/transport/persistence errors by the operation the user sees fail; do not create an `alt` for every internal check. Keep detailed error codes and omitted failure internals in source comments.
- Omit routine middleware, DTO field validation, utilities, logging, discovery heartbeats, and repetitive CRUD details. For ordinary protected UCs, keep the authentication precondition in a non-rendering comment or the delivery summary. For login, recovery, token, permission, or access-management UCs, include the relevant security behavior instead of excluding it automatically.
- Diagram text is English. Keep source casing for classes, endpoints, event types, topics, fields, and status values. Responses to the user follow the user's language.

## Participants and boundaries

- One involved architectural element per participant. Separate actual screens, controllers, services, repositories, and external systems; do not combine classes with `/`, `&`, `+`, commas, or `and`. A legitimate existing service name containing `&` is not a merged class.
- Include only participants with meaningful messages. React components are not EJS views. Do not add a separate boundary for every component, hook, or modal unless it represents a distinct screen or interaction responsibility relevant to the UC.
- Use `actor` for the real initiating role, `boundary` for a screen, rectangular `participant ":ClassName" as Alias` for application classes, `participant ":ApiGateway" as Gateway`, and `database "learning_db" as LearningDB` for an actual service-owned database. The gateway's display name is exactly `:ApiGateway`; retain its alias consistently in messages and activations.
- Give each boundary a readable English screen name, such as `View Course Page` or `Create Course Page`. Keep React component names and source paths in source-evidence comments or the delivery summary, not in the displayed boundary label. For UC14 use `boundary "View Course Page" as Screen`; for UC14.2 use `boundary "Create Course Page" as Screen`.
- Left-to-right order: actor, screen(s), gateway, owning service's controller/service/persistence, downstream service participants, external systems or Kafka, then all databases. Declare every database after all non-database participants so the DB lifelines occupy the far right, including in flows involving multiple services. Keep separate DB participants and their real service ownership.
- Show API Gateway on browser requests that actually traverse it. Label the public HTTP method/path and show a path rewrite only when one actually occurs. Omit redundant `no path rewrite` annotations. Do not imply that every internal service call passes through the gateway.
- Omit frontend API wrappers and intermediary HTTP client lifelines such as `LearningClient` and `TenantClient`. Trace their implementation as evidence, but draw the calling business service directly to the receiving controller with the real REST method/path, for example `CoursesService -> EnrollmentsController: POST /api/v1/enrollments/learner-counts`. Preserve user/organization scope, timeout/error outcomes and actual service boundaries; hiding an adapter does not change the implementation. Keep client names and transport details in source comments. A route belongs on a message, not on a separate lifeline.
- NestJS/Prisma: use the actual repository where present. Add `:PrismaService` only when useful; a Prisma schema model is data, not an active entity calling the DB. Spring Boot/JPA: show the actual repository; do not invent active entity operations or missing layers. A repository may call its owned DB directly at this abstraction level.
- Never access another service's database directly or use one generic shared DB. Show an implemented REST call directly to the receiving controller, or an implemented event exchange across service boundaries. Do not invent a consumer, topic, gateway, integration, or processing step from architecture prose alone.
- Preserve `organizationId` where it changes a business decision or data scope, without repeating every technical context header on every arrow.

## Presentation and interaction semantics

Start with the following header, once. Do not add a visible `title` to the diagram. The filename identifies the UC; its code and name may also be kept in a non-rendering PlantUML comment such as `' UC14 - View Managed Courses`.

```plantuml
@startuml
autonumber "<b>0.</b> "
hide footbox
skinparam backgroundColor white
skinparam ParticipantBackgroundColor white
skinparam ActorBackgroundColor white
skinparam BoundaryBackgroundColor white
skinparam DatabaseBackgroundColor white
skinparam LifeLineBackgroundColor white
skinparam LifeLineBorderColor black
skinparam ArrowColor black
skinparam ParticipantBorderColor black
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam BoxPadding 10
skinparam MaxMessageSize 200
```

Declare every participant once before any message, end with one `@enduml`, and leave no placeholders. No layer `box` groups, colored themes, repeated participant boxes at the bottom, or rendered `note`, `hnote`, or `rnote` annotations. Keep source evidence, assumptions, preconditions, and implementation gaps in apostrophe comments or the delivery summary; these must not create visible note boxes.

Use the formatted `autonumber` directive above for bold numbers followed by a period and a space, for example **1.** Open /instructor/courses. Let PlantUML number the messages; do not add manual numbers or Markdown/HTML entity escapes to message text. For a forwarded request, put context on the next line, for example `GET /api/v1/courses\nTrusted userId, organizationId, role`.

- Synchronous request or processing call: `->`.
- Response or result to a prior synchronous call: `-->>` (dashed, open head).
- Asynchronous command, webhook, callback, event publication, or event delivery: `->>` (solid, open head). A callback starts a new interaction; it is not the return of an earlier browser call.
- Read the producer/consumer code before showing Kafka. Show broker acceptance separately from consumer completion when relevant; publishing does not prove downstream work finished. An HTTP success must not imply that asynchronously generated notifications or certificates already exist.
- Use explicit activation on every involved lifeline, including actor and screen. Activate the actor before its first action and the screen on entry; keep their parent bars through the final user-visible outcome, closing them after the outer fragment. Gateway, controller, service, repository, DB, downstream consumer and external system stay active for their own work through the matching reply. Activate an asynchronous receiver for its own work without keeping the producer waiting for it.
- Every synchronous self-call `X -> X` must run inside an existing activation and be followed immediately by `activate X`, opening a nested bar at the next depth. Close that child execution with `deactivate X` when its work finishes, preserving the parent until the enclosing operation finishes. For a short local check, the pair may directly follow the self-message; when the self-call owns downstream work, keep the child open for that work. Blank lines and source comments may separate the call and activation. Use the same lifeline alias, including for UI self-calls; do not simulate nesting by ending and restarting the parent. Self-returns (`X -->> X`) and asynchronous self-messages (`X ->> X`) do not automatically open synchronous nested activations.
- Balance activations along every possible path, not by counting text occurrences. Shared return/deactivation after `end` is valid when it carries the operation's success/error outcome to the caller; guard dependent continuation explicitly. If each branch returns separately, each branch closes the incoming activation exactly once.
- Also track PlantUML's activation depths in source order: closing a bar in the first operand does not automatically reopen it at `else`. Immediately after each `else/and`, explicitly restore only the incoming bars closed by the preceding operand before drawing that branch's work and responses. Reopen the exact original depth; leave already-active actor/screen/parent bars untouched. These restoration directives provide the same execution in another alternative, not an extra nested execution or a new call. Verify all lower branches in the render; a balanced business-path check alone is insufficient. See the reference's separate-return example.
- Use `alt/else` for major alternatives and label each result with `successfully` or `failed`, such as `Courses loaded successfully` / `Course loading failed`. An empty list is a valid success outcome, and absence of an optional feature is not a failure. Use `opt` for optional actions whose skipped path can converge, and `loop` for meaningful repetition. If optional processing can fail, use a readiness guard on the shared continuation so failure stops and the skipped path still proceeds. Optional/repeated bodies restore activation depth, including the implicit skipped path. Use `par/and` only for actual independent concurrency and balance each operand locally. `group` is allowed for a real named phase.
- For a conditional UC, use one real outer `alt` to enclose dependent processing and user outcomes. Nest checks when their work depends on an earlier result, but allow stages to converge inside the outer operand. An optional cover upload can finish in `opt`, followed by an explicit readiness `alt`: no cover or a valid uploaded cover proceeds to the one shared create flow; a failed upload stops. Do not duplicate the entire create flow or force every technical check into a nested frame merely to obtain a visual pyramid. Use `alt/else/end` for alternatives and `opt/end` for optional work.
- Use plain fragment labels compatible with draw.io's PlantUML importer. Do not use `<space:...>` padding, `group ... alt` headers or invisible formatting tricks; these can appear literally in draw.io even when a newer local renderer accepts them. Keep guards short, with at most two explicit lines, and use normal renderer spacing. Preserve actor/screen and branch activations; do not remove bars to make room for text. Inspect labels in the actual target renderer when available.
- Keep the diagram compact with normal spacing, readable fonts, short labels and only meaningful calls/self-calls. Preserve service-owned databases, source-backed cross-service calls, optional behavior, cleanup and nested self-call activations. Group technical failures into one failed operation outcome when they lead to the same UI behavior; retain distinct business outcomes the user needs to understand. An outcome-level `alt` may expand the successful operation trace while summarizing failed attempts in one operand: do not depict successful DB/provider work as unconditional after a failed check. Explain omitted failure internals in comments. The legacy `ParticipantPadding` directive stays omitted because newer PlantUML versions ignore it and may show a warning banner.
- Follow the concise business-message style of `docs/uml/sequence/UC11_SequenceDiagram.puml` when available; its classes, domain, title, and old numbering conventions are not LearnUP requirements. Prefer one short action or result per arrow, such as `Load managed courses`, `Count InProgress learners by course`, `Return learner counts`, or `Save Draft Course`. Use one line, or at most two explicit lines when the exact HTTP endpoint and essential context need separation. Move detailed predicates, ORM calls, environment URLs, framework behavior, field lists, and explanatory caveats to source comments. Preserve business-critical meaning such as organization scope, InProgress-only counts, atomic creation, and cleanup on failure. Include main method names only where useful for traceability.

See the reference for safe branch and asynchronous examples. They illustrate notation, not evidence that a specific UC or Kafka integration exists.

## Validation and delivery

Run from the repository root after writing or revising the diagram:

```text
python .agents/skills/learnup-drawio-sequence-diagram/scripts/validate_puml.py docs/uml/sequence/[UC_CODE]_SequenceDiagram.puml
```

Fix reported errors and rerun. The validator checks a deliberately limited PlantUML sequence subset: declarations, aliases, used participants, required header and number format, absence of visible titles and notes, explicit `successfully`/`failed` labels for `alt/else`, at most two explicit message lines, boundary labels without source filenames, gateway display name, databases declared last, allowed arrows, actor/screen activation, active synchronous senders and return callers, nested activation after self-calls with an active parent, source-order activation restoration at branch boundaries, one outer `alt`, plain guard labels with at most two explicit lines, rejection of padding markup and custom headers imitating `alt`, omission of colon-prefixed application `*Client` lifelines, and branch-aware plus source-order activation balance. UC identification is checked through the filename, not a rendered title or optional comment. It does not verify whether an outcome label or dependency is semantically true, whether a message is concise, frame geometry, source fidelity, HTTP correctness, database ownership, full PlantUML syntax, or draw.io rendering. Review those separately.

A successful render on a recent local PlantUML version does not prove that draw.io's importer supports the same syntax. Prefer the plain subset above and, when possible, compare an older renderer as a compatibility check. When PlantUML rendering or draw.io import is available, inspect the whole diagram, including every lower `else`: actor/screen bars persist, each request and response touches the appropriate activation, and self-calls have visible child bars. Check frame nesting, guard/tab overlap, clipped labels, arrowheads and top-only participant boxes. SVG metadata can associate `participant-lifeline` activation rectangles with each `message` arrow for coverage checks; inspect the image too. If rendering is unavailable, state that static validation passed and visual import remains unverified. Never equate a static pass with guaranteed draw.io compatibility. Do not upload project diagrams to a remote rendering service without authorization.

Final response: link the output, summarize the main flow, list the relevant source paths and meaningful omissions/assumptions, and report static and visual validation separately. Do not paste the whole `.puml` unless requested.
