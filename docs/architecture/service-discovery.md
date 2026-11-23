# Service discovery and routing

The [Gateway configuration](../../gateway/api-gateway/src/main/resources/application.yml) declares routes explicitly. Its discovery locator is disabled.

| Target | Routing | Compose default |
| --- | --- | --- |
| Identity | Eureka | `lb://IDENTITY-SERVICE` |
| Notification | Eureka | `lb://NOTIFICATION-SERVICE` |
| Audit | Eureka | `lb://AUDIT-SERVICE` |
| Tenant | `TENANT_SERVICE_URL` | `http://tenant-service:8084` |
| Course | `COURSE_SERVICE_URL` | `http://course-service:8083` |
| Learning | `LEARNING_SERVICE_URL` | `http://learning-service:8085` |
| Assessment | `ASSESSMENT_SERVICE_URL` | `http://assessment-service:8086` |
| Achievement & Reporting | `ACHIEVEMENT_REPORTING_SERVICE_URL` | `http://achievement-reporting-service:8087` |

Eureka supplies service instances to the load balancer. Docker DNS resolves the business service names in [Compose](../../docker-compose.yml). See [ADR 0008](../adr/0008-docker-dns-for-business-services.md) and the [Eureka setup guide](../../infrastructure/eureka-server/README.md).
