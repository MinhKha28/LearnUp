# Source-backed class modeling for LearnUP

## Locate evidence

Use repository-relative paths and targeted `rg` searches for the requested UC or feature.

| Concern | Source location |
| --- | --- |
| Find the feature from UI | `frontend/src/router.tsx`, related pages and API calls in `frontend/src/services/` |
| Identify the owning backend | Gateway route configuration in `gateway/api-gateway/src/main/resources/application.yml` |
| NestJS classifiers | `services/<service>/src/modules/`, relevant controller/service/repository/DTO files |
| Shared repository abstraction | `services/learning-service/src/common/repository/base.repository.ts` where actually extended |
| Persistence types | Relevant `services/<service>/prisma/schema.prisma`, actual Prisma service and repository usages |
| Downstream client contracts | Relevant files under a service's `src/infrastructure/clients/` |
| Spring classifiers | Relevant controller/service/repository/domain/DTO/client files under `services/<service>/src/main/java/com/learnup/` |
| Framework parent/interface | Imported declaration or library API when directly important; do not enumerate the framework hierarchy |
| Architectural intent | Relevant `docs/architecture/`, `docs/business/`, and `contracts/` files; check against implementation |

Name a service/package in the diagram only when needed to disambiguate ownership. LearnUP's business services are `tenant-service`, `course-service`, `learning-service`, `assessment-service`, and `achievement-reporting-service`; supporting services are `identity-service`, `notification-service`, and `audit-service`. Determine the actual Java/NestJS implementation from that service rather than assuming all services share layers or language.

## Interpret actual declarations

- `class EnrollmentsRepository extends BaseRepository` supports generalization to the real abstract `BaseRepository`.
- `BaseRepository` retains a protected `PrismaService` constructor parameter property. This supports an association from the base repository to `PrismaService`, not composition.
- A NestJS constructor parameter with `private`, `protected`, `public`, or `readonly` can declare a retained property. A plain parameter alone does not prove that it is stored. Follow assignments when necessary.
- `UserRepository extends JpaRepository<User, UUID>` is interface inheritance. If the generic framework interface is relevant, use a quoted display name and safe alias, such as `interface "JpaRepository<User, UUID>" as JpaUserRepository`. Do not describe the interface as a concrete class implementing JpaRepository.
- An explicit class `implements` interface relationship uses realization. TypeScript structural compatibility or `@Inject(TOKEN)` alone does not prove that the class explicitly implements a particular interface. Inspect provider bindings; show the consuming class's association to an injected interface where supported.
- A DTO is not automatically an entity. Retain its actual classifier kind and use a descriptive stereotype only when necessary.
- Prisma `model Enrollment` is a data model, not a handwritten class with query operations. If it matters in the requested class view, use `<<PrismaModel>>`. A repository's use of `prisma.enrollment` can support a dependency on that model; do not pretend the repository stores a live Enrollment object unless it actually does.
- TypeScript `interface CreatedEnrollment` is an interface representing data shape. Use `<<DataShape>>` if that clarification matters. Do not force data interfaces into a service implementation hierarchy.
- `organizationId`, `courseId`, or `learnerId` referring to another service establishes an identifier dependency, not an in-memory association to a remote entity. A local snapshot model is a separate classifier from the remote model.

## Overview and detailed bodies

The overview uses an explicit separator and no fabricated members:

```plantuml
abstract class "BaseRepository" as BaseRepository {
  --
}
```

Detailed mode can expose relevant existing members. For this real base class, a concise representation is:

```plantuml
abstract class "BaseRepository" as BaseRepository {
  #prisma: PrismaService
  --
  #db(tx?: Prisma.TransactionClient): DbClient
}
```

Read the source before reusing either example; names and signatures may change. Optional constructor parameters, return types, and optional data fields should retain their source meaning. Do not add a public operation solely to fill a compartment.

## Multiplicity, ownership, and dependencies

Keep cardinalities out of inheritance and realization. For an association, nullable/optional scalar references may establish `0..1`; a required scalar reference may establish `1`; collection types establish potential multiplicity but do not prove a minimum of one. Uniqueness and business constraints may further restrict these values. If the evidence is insufficient, omit the multiplicity.

Use aggregation/composition sparingly. Dependency injection, shared service objects, matching UUIDs, and database deletion cascades are insufficient on their own. A class diagram does not need diamonds to be complete.

Do not turn controller-to-service-to-repository usage into a sequence of numbered business actions. The relation explains a structural reference or use; its label, if necessary, should be a role or short relation description rather than an HTTP call flow.

## Supported static-validation subset

Use explicit aliases with `class`, `abstract class`, `interface`, or `enum` and multiline `{ ... }` bodies. Optional stereotypes follow the alias. Flat declarations or white `package "service-name" { ... }` groups are supported. Declare classifiers before links.

Supported links: `--|>`, `<|--`, `..|>`, `<|..`, `..>`, `<..`, `-->`, `<--`, `--`, `o--`, `--o`, `*--`, `--*`, and hidden layout links `-[hidden]right->` / `-[hidden]down->`. Quoted multiplicities and a trailing `: label` are supported on associations. Use canonical notation rather than alternative arrow spellings. Isolated classifiers produce warnings, not invented links or an automatic failure.

The validator intentionally excludes macros, notes, inline class bodies, and other diagram languages. An unsupported construct must be simplified without changing meaning, or explicitly reported as outside static validation; never claim it passed. Detailed member lines are checked only for nonempty content and block boundaries, not complete Java/TypeScript syntax.

PlantUML syntax references: [class diagram documentation](https://plantuml.com/class-diagram), [local Smetana layout](https://plantuml.com/smetana02). These describe syntax; LearnUP source remains the evidence for included classes and relationships.
