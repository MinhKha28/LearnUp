# LearnUP repository instructions

## Supporting-service development scope

This section governs authorized work in `services/identity-service/`,
`services/notification-service/`, `services/audit-service/`, and directly necessary
Gateway, Compose, contract, test or documentation integration files. It does not
authorize changes to another team's business services. Honor more specific local
instructions and the user's task boundaries; do not change frontend conventions.
An audit, explanation or review request does not authorize implementation or commits.

## Safe automatic Git workflow

For each independently completed implementation or documentation task:

1. Record HEAD, `git status --short`, unstaged/staged diffs and untracked files.
2. Define the exact task/file scope. Preserve unrelated work, including deletions.
   If overlapping changes cannot be safely attributed, stop and explain the conflict.
3. Implement one coherent change and add/update relevant regression tests.
4. Run appropriate verification, review the complete final diff, and check for
   real credentials, sensitive examples and generated build artifacts.
5. Stage only explicit task paths. Never use `git add .` or `git add -A`.
6. Inspect `git diff --cached`, its exact file list, and `git diff --cached --check`.
   Do not commit an index containing unrelated work; never silently unstage user work.
7. Automatically create one Conventional Commit without asking for confirmation
   when the task is complete, verified and safely isolated. A user's explicit
   no-commit instruction overrides this default. Do not push unless requested.
8. Report the commit hash/message, changed files, actual verification results and
   final status. Split independent tasks into separate commits.

Do not commit if relevant tests fail, required verification is blocked without a
reliable alternative, correctness/security concerns remain in the proposed change,
the change is incomplete, unrelated staged work cannot be excluded safely, or real
secrets/credentials/generated artifacts are included. Clearly synthetic isolated-test
fixtures are not deployment secrets; never reuse them in deployment configuration.
Preserve completed commits if a later task is blocked and report the blocker.

Use `feat(identity): ...`, `fix(identity): ...`, `refactor(identity): ...`,
`test(identity): ...`, `docs(identity): ...`, or `chore(identity): ...` for Identity;
use an appropriate service/integration scope for other authorized work. Do not
amend unless explicitly requested. Never use destructive Git cleanup (`git reset`,
`git restore`, `git clean`), force push or history rewriting. Do not silently change
Git author identity or global configuration. If needed, use command-scoped
`git -c safe.directory=D:/Study/learnup ...` rather than global configuration.

## Engineering standards

- Treat readable DOCX files in `docs/source-of-truth/` as authoritative business
  requirements. Current filenames may omit `(2)`. Audits and code comments are
  evidence, not new business rules.
- Preserve ownership: Identity owns credentials/authentication; Tenant owns canonical
  accounts, Organization membership and business lifecycle. Notification delivers
  messages; Audit owns its own records. Do not expand scope implicitly.
- Prefer small reviewable changes, existing `com.learnup.identity` package conventions,
  constructor injection, thin controllers, service-level business rules, validated
  request DTOs and explicit public response DTOs. Never return JPA entities publicly.
- Do not expose credentials, raw tokens, password hashes or internal secrets in logs,
  documentation examples, exceptions or unintended API responses. Report existing
  out-of-scope security findings rather than silently expanding the task.
- Preserve ID-H1/ID-H2: no public registration/token-creation bypass, no raw-header
  principal fallback, authenticated internal provisioning, and no public Identity
  container port. Documentation must not weaken the trust boundary.
- Preserve PostgreSQL/Flyway compatibility. Do not alter migrations for tooling work.
  Avoid broad refactors and never create directories from parsed document/table text.
- Use Lombok selectively for accessors/constructor boilerplate, not `@Data` or unsafe
  equality/`toString()` on entities or secret-bearing objects. Keep meaningful invariants.
- Use Spring MapStruct mappers with explicit safe response fields; keep processor
  configuration reproducible alongside Lombok. Do not commit generated sources.

## Verification

Use Java 21 and each service's Maven POM. Run the complete Identity suite for Identity
behavior changes, Gateway tests for affected routing/security, and a clean compile/
package when changing annotation processors or dependencies. Run Compose configuration
validation for Compose changes and `git diff --check` before committing. Standard
commands are `mvn test` and `mvn clean verify` from the relevant service directory.
Use the owner's existing Maven cache when necessary without changing global settings.
Distinguish H2/mocked-Tenant tests from real PostgreSQL/deployed integration tests.
Never fabricate successful test results or weaken assertions merely to pass a build.
