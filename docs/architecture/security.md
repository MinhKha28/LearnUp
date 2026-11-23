# Request authentication and authorization

## Gateway

[JwtAuthenticationFilter](../../gateway/api-gateway/src/main/java/com/learnup/gateway/filter/JwtAuthenticationFilter.java) validates bearer JWTs on protected routes. It removes client-supplied `X-User-ID`, `X-User-Role`, `X-Organization-ID`, `X-Internal-Key` and `X-Service-Name`. It forwards identity claims from the validated token and supplies the configured internal key. Whitelisted routes also receive the configured key, with client identity headers removed. The [route configuration](../../gateway/api-gateway/src/main/resources/application.yml) defines the whitelist.

## Downstream authentication

Protected business endpoints authenticate `X-Internal-Key` against `INTERNAL_SERVICE_KEY` before establishing user context. For example, Learning's [InternalAuthGuard](../../services/learning-service/src/common/guards/internal-auth.guard.ts) verifies the key and creates `request.user`. Its [User decorator](../../services/learning-service/src/common/decorator/customize.ts) supplies that authenticated principal to controllers. Pass that principal to the service and enforce the role and organization against the resource being accessed.

[IdentityRequestAuthenticationFilter](../../services/identity-service/src/main/java/com/learnup/identity/security/IdentityRequestAuthenticationFilter.java) authenticates internal provisioning with the internal key and requires both the internal key and a valid bearer JWT for protected user routes. It installs the principal in Spring Security's context. Public authentication routes follow the Identity security configuration. Identity has no published container port in [Compose](../../docker-compose.yml).

[Audit's filter](../../services/audit-service/src/main/java/com/learnup/audit/security/AuditServiceAuthenticationFilter.java) and [Notification's in-app filter](../../services/notification-service/src/main/java/com/learnup/notification/security/InAppNotificationAuthenticationFilter.java) establish request authentication at their service boundaries. Correlation IDs are tracing metadata.
