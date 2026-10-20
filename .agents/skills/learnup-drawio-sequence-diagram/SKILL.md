---
name: learnup-drawio-sequence-diagram
description: Create or revise source-backed LearnUP sequence diagrams in PlantUML for draw.io, including React screens, API Gateway, NestJS or Spring Boot services, service-owned databases, and implemented REST or Kafka interactions. Use for a LearnUP use case or sub-use case; exclude activity, class, ERD, deployment, and use-case diagrams.
---

# LearnUP Draw.io Sequence Diagrams

Create one business-level sequence diagram per requested LearnUP use case. Preserve the EventSphere skill's draw.io presentation conventions while following LearnUP's actual implementation. Read [references/learnup-conventions.md](references/learnup-conventions.md) for source locations, ownership, and notation before drafting.

## Scope and evidence

- Determine the requested UC code, name, actor, trigger, and outcome from the user's specification and relevant source. Support subcodes such as `UC25.3`; there is no UC01-UC26 limit. Ask only when the intended UC cannot be identified. Never invent a UC catalog.
- Default output: `docs/uml/sequence/[UC_CODE]_SequenceDiagram.puml`. Honor an explicit alternate location; the validator accepts any path and checks the UC filename convention.
- Follow the relevant React page and API call through gateway routing, controller, service, persistence, and directly involved downstream clients or event handlers. Use targeted searches; do not read unrelated modules.
- For diagrams of current behavior, implementation is evidence of what executes. Use specifications and contracts to explain intent; disclose conflicts rather than silently claiming that planned behavior exists. If a design for unimplemented behavior is explicitly requested, mark it as proposed and distinguish assumptions.
- Include the main success path and normally one or two consequential business failures. Preserve checks that determine eligibility, tenant boundaries, deadlines, enrollment status, or other requested business outcomes.
- Omit routine middleware, DTO field validation, utilities, logging, discovery heartbeats, and repetitive CRUD details. For ordinary protected UCs, state authentication as a precondition. For login, recovery, token, permission, or access-management UCs, include the relevant security behavior instead of excluding it automatically.
- Diagram text is English. Keep source casing for classes, endpoints, event types, topics, fields, and status values. Responses to the user follow the user's language.

## Participants and boundaries

- One involved architectural element per participant. Separate actual screens, controllers, services, repositories, and external systems; do not combine classes with `/`, `&`, `+`, commas, or `and`. A legitimate existing service name containing `&` is not a merged class.
- Include only participants with meaningful messages. React components are not EJS views. Do not add a separate boundary for every component, hook, or modal unless it represents a distinct screen or interaction responsibility relevant to the UC.
- Use `actor` for the real initiating role, `boundary` for a screen, rectangular `participant ":ClassName" as Alias` for application classes, `participant "API Gateway" as Gateway`, and `database "learning_db" as LearningDB` for an actual service-owned database.
- Prefer left-to-right: actor, screen(s), gateway, owning service's controller/service/persistence, downstream service participants and their databases, external systems or Kafka. Adapt for readability without changing responsibility.
- Show API Gateway on browser requests that actually traverse it. Label the public HTTP method/path and any actual rewrite. Do not imply that every internal service call passes through the gateway.
- A route is not a controller. Put routing on a message unless route logic itself is important. Frontend API wrappers and downstream HTTP client classes are optional when their behavior matters.
- NestJS/Prisma: use the actual repository where present. Add `:PrismaService` only when useful; a Prisma schema model is data, not an active entity calling the DB. Spring Boot/JPA: show the actual repository; do not invent active entity operations or missing layers. A repository may call its owned DB directly at this abstraction level.
- Never access another service's database directly or use one generic shared DB. Show an implemented REST client or implemented event exchange across service boundaries. Do not invent a consumer, topic, gateway, integration, or processing step from architecture prose alone.
- Preserve `organizationId` where it changes a business decision or data scope, without repeating every technical context header on every arrow.

## Presentation and interaction semantics

Start with the following header, once, replacing the title placeholders:

```plantuml
@startuml
title [UC_CODE] - [UC_NAME]
autonumber
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
skinparam ParticipantPadding 25
skinparam BoxPadding 10
skinparam MaxMessageSize 80
```

Declare every participant once before any message, end with one `@enduml`, and leave no placeholders. No layer `box` groups, colored themes, or repeated participant boxes at the bottom.

- Synchronous request or processing call: `->`.
- Response or result to a prior synchronous call: `-->>` (dashed, open head).
- Asynchronous command, webhook, callback, event publication, or event delivery: `->>` (solid, open head). A callback starts a new interaction; it is not the return of an earlier browser call.
- Read the producer/consumer code before showing Kafka. Show broker acceptance separately from consumer completion when relevant; publishing does not prove downstream work finished. An HTTP success must not imply that asynchronously generated notifications or certificates already exist.
- Use explicit `activate Alias` / `deactivate Alias` around meaningful processing on gateway, controller, service, repository, DB, downstream consumer, and external system. Activate the asynchronous receiver for its own work; do not keep the producer active waiting for the consumer. UI activations are optional.
- Balance activations along every possible path, not by counting text occurrences. Prefer shared return/deactivation after `end` when branches converge. If each branch returns separately, each branch must close the incoming activation exactly once.
- Use `alt/else` for major alternatives, `opt` for optional behavior, and `loop` for meaningful repetition. Optional or repeated bodies must restore activation depth; account for the implicit skipped path. Use `par/and` only for actual independent concurrency and balance each operand locally. `group` is allowed for a named phase.
- Use concise business messages such as `Check enrollment eligibility`, `Load course introduction`, and `Save enrollment`; include main method names only where helpful for traceability. Avoid mirroring every ORM call.

See the reference for safe branch and asynchronous examples. They illustrate notation, not evidence that a specific UC or Kafka integration exists.

## Validation and delivery

Run from the repository root after writing or revising the diagram:

```text
python .agents/skills/learnup-drawio-sequence-diagram/scripts/validate_puml.py docs/uml/sequence/[UC_CODE]_SequenceDiagram.puml
```

Fix reported errors and rerun. The validator checks a deliberately limited PlantUML sequence subset: declarations, aliases, used participants, required header, allowed arrows, processing activation coverage, and branch-aware activation balance. It does not verify English meaning, source fidelity, HTTP correctness, database ownership, full PlantUML syntax, or draw.io rendering. Review those separately.

When PlantUML rendering or draw.io import is available, render/import and inspect clipped labels, visible activations, arrowheads, and top-only participant boxes. If unavailable, state that static validation passed and visual import remains unverified. Never equate a static pass with guaranteed draw.io compatibility. Do not upload project diagrams to a remote rendering service without authorization.

Final response: link the output, summarize the main flow, list the relevant source paths and meaningful omissions/assumptions, and report static and visual validation separately. Do not paste the whole `.puml` unless requested.
