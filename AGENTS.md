# LearnUP repository guide

LearnUP is an organizational training platform with a React frontend, a Spring Gateway,
five NestJS business services, and three Spring supporting services. All paths below
are relative to the repository root. Before working in a part, read its scoped
AGENTS.md and README.md; do this explicitly even if your tool does not discover
nested instructions automatically. A link is a routing instruction, not an import.

## Map and scoped instructions

| Part | Path / instructions | Ownership |
| --- | --- | --- |
| Frontend | frontend/AGENTS.md | React, TypeScript, Vite, role UI |
| Identity | services/identity-service/AGENTS.md | Credentials and authentication |
| Notification | services/notification-service/AGENTS.md | Message delivery |
| Audit | services/audit-service/AGENTS.md | Its own audit records |
| Tenant | services/tenant-service/AGENTS.md | Canonical accounts, Organizations, memberships, subscriptions |
| Course | services/course-service/AGENTS.md | Course content and versions |
| Learning | services/learning-service/AGENTS.md | Enrollment and progress |
| Assessment | services/assessment-service/AGENTS.md | Exercises, grading, peer review |
| Achievement & Reporting | services/achievement-reporting-service/AGENTS.md | Certificates and reporting |
| Gateway | gateway/api-gateway/AGENTS.md | Routing and authenticated request context |
| Discovery | infrastructure/eureka-server/ | Java service discovery; read README.md |
| Java common | libraries/java-common/ | Shared Java technical utilities; read README.md |
| TypeScript common | libraries/ts-common/AGENTS.md | Framework-neutral shared contracts/utilities |
| Storage | libraries/ts-storage/ | Provider library; read README.md |

## Build and verification entry points

Use Node 22 for the current CI workflow and Java 21 with each Java component's POM.
Run commands from the named component directory. Install/build file-linked libraries
before their consumers. Read package.json for prerequisites and additional suites.

- Java common: mvn install; Java services, Gateway and Eureka: mvn test and mvn clean verify.
  Install libraries/java-common first for components depending on it.
- TypeScript libraries: npm ci, npm run build, npx tsc --noEmit, npm test.
- NestJS services: npm ci, npx prisma generate --config prisma7.config.ts, npm run build.
  For Learning, Tenant, Assessment and Achievement run npm run test:unit; Course uses
  npm test -- --ci. Integration prerequisites and commands live in each service README.
- Frontend: npm ci, npm run build, npm run typecheck, npm test, npm run lint.
- Backend lint: use the CI ESLint command without --fix; several package lint scripts
  mutate files. Report nonblocking CI checks accurately; do not equate skipped suites
  or mocked dependencies with PostgreSQL or deployed integration coverage.
- Shared TypeScript contract changes: search all consumers, build the library fresh,
  and typecheck both build and default configurations of every consumer.
- Compose edits: docker compose config --quiet with privately supplied configuration.
  Never print rendered secrets. Run git diff --check before committing.

## Shared constraints

- Honor the requested scope and service ownership; review-only work does not authorize
  implementation or commits. Authoritative business requirements are the readable
  DOCX files in docs/source-of-truth/. Audits and comments are evidence, not new rules.
- Keep one database per service. Use API/event contracts for cross-service access.
  Update tracked database documentation with its migration. Compute values compared
  by database CHECK constraints in SQL instead of round-tripping through JavaScript.
- Never expose credentials, raw bearer tokens, hashes or internal keys in logs,
  examples or unintended responses. Preserve authenticated internal calls and tenant
  isolation. Do not return JPA entities as public responses.
- Frontend language and UI terminology: follow frontend/AGENTS.md.
- In Course, Assessment and Tenant, mark endpoints intended for other services with
  @ServiceCall(); the guard authenticates the incoming request. Definitions are in
  services/course-service/src/common/decorator/customize.ts,
  services/assessment-service/src/common/decorator/customize.ts and
  services/tenant-service/src/common/decorator/customize.ts. The decorator sets
  metadata; callers must explicitly send the required internal headers. The marked
  endpoints use x-internal-key; Course and Assessment also require x-organization-id.
  User-context caller methods additionally send x-user-id and x-user-role as needed.
  These names are defined in libraries/ts-common/src/context/headers.ts; preserve
  each endpoint's actual guard contract rather than assuming identical requirements.
- Enforce the effective product/provider upload limit; map provider size rejection
  to HTTP 413 FILE_TOO_LARGE. Configure Cloudinary privately; keep Compose defaults
  empty for CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.
  Signed provider API requests use api.cloudinary.com.
- Use isolated resources for live external-account probes, with a dedicated asset
  prefix and a throwaway script outside the repo; remove only probe-created assets
  and verify that prefix is empty afterwards.
- Legacy business-rule exports may use old BR numbers. Use the supplied new-to-old
  crosswalk; do not infer a renumbering from matching numeric IDs.
- Keep changes incremental. Preserve unrelated edits/deletions and staged work.
  Record HEAD/status/diffs before implementation; stage explicit task paths only.
  Inspect the staged diff and its file list. Never use destructive cleanup, force
  push, history rewriting, or silently change Git identity/global configuration.
- After a complete, safely isolated implementation/documentation task passes required
  verification, make one Conventional Commit unless the user says not to commit.
  Do not commit failures, incomplete work, secrets, generated outputs or unrelated work.
  Do not amend or push without explicit authorization. Report real results and status.
- Concurrent implementation sessions use separate worktrees. Install Node dependencies
  with npm ci and preserve lockfiles unless dependency changes are the task.
- Keep personal instructions and workstation paths out of public content. Keep
  docs/uml/ sequence diagrams, docs/spec/ extracts, local diagram tooling and ignored working documents
  local. Do not publish ignored files merely because a task reads them.

## References and reusable workflows

Read CONTRIBUTING.md, contracts/openapi/README.md, contracts/events/README.md,
docs/database/README.md and the relevant docs/adr/ decisions when their subject applies.
Frontend work uses .agents/skills/learnup-frontend/SKILL.md; Figma/UI work also uses
.agents/skills/learnup-ui-design/SKILL.md. Read these workflows explicitly when needed.
They contain detailed workflows, not automatically concatenated project instructions.
