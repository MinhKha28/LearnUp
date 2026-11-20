# Gateway instructions

Preserve JWT verification, removal/replacement of untrusted context headers, internal
channel authentication and routing boundaries. Never treat raw incoming identity,
role or Organization headers as an authenticated principal. Identity remains internal
with no published Compose port. Inspect src/main/resources/application.yml and
security filters before routing changes; routes mix Docker DNS and service discovery.

Use Java 21. Install libraries/java-common first, then run mvn test and mvn clean
verify with this POM. Include Gateway tests whenever routing/security is affected.
Read README.md and relevant OpenAPI contracts; never log tokens or service keys.
