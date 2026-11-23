# Identity instructions

Identity owns credentials/authentication. Tenant owns canonical users, Organization
membership and lifecycle. Work stays within the user's authorized scope and necessary
integration files. Use com.learnup.identity conventions, constructor injection,
thin controllers, validated request DTOs, service rules and explicit response DTOs.

Preserve ID-H1/ID-H2: no public registration/token-creation bypass, raw-header
principal fallback, unauthenticated internal provisioning or published Identity
container port. Never put the internal-channel credential in browser configuration.

Preserve PostgreSQL/Flyway compatibility. Use Lombok for safe boilerplate, never
@Data or unsafe equality/toString on entities or secret-bearing objects. Use Spring
MapStruct with explicit safe response fields and reproducible Lombok processor
configuration. Do not commit generated sources or alter migrations for tooling work.

Use Java 21 and this POM. Install libraries/java-common first. Run mvn test and
mvn clean verify; run the complete Identity suite for behavior changes and clean
verification for processor/dependency changes. Run Gateway tests for affected routing
or authentication. Default tests use H2/mocked Tenant where declared. Opt-in real
PostgreSQL/SMTP procedures and limitations are in DEVELOPMENT.md, not deployment proof.
Use feat(identity), fix(identity), refactor(identity), test(identity), docs(identity)
or chore(identity) Conventional Commit scopes. Read README.md and DEVELOPMENT.md.
