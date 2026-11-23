# Notification instructions

Notification delivers messages; originating services own the triggering business lifecycle.
Use the existing com.learnup.notification conventions, constructor injection, thin
controllers, validated request DTOs and explicit safe response DTOs. Keep JPA entities
internal and preserve PostgreSQL/Flyway compatibility. Never expose secrets or raw
tokens. Do not alter migrations for tooling work.

Use Java 21 and this POM. Install libraries/java-common first, then run mvn test
and mvn clean verify. Keep Lombok and mapping processor configuration reproducible
when used; do not commit generated sources. Read README.md and the relevant event
contracts for behavior and verification prerequisites.
