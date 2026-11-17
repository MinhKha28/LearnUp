# LearnUP architecture

The React frontend sends HTTP requests to Spring Cloud Gateway. The Gateway routes requests to eight services. [Routing and discovery](service-discovery.md) gives the route targets and [request authentication](security.md) describes the trust chain.

```text
React frontend
  └─ Spring Cloud Gateway
     ├─ Eureka → Identity, Notification, Audit (Spring Boot)
     └─ Docker DNS → Tenant, Course, Learning, Assessment,
                      Achievement & Reporting (NestJS)
```

Each service owns its PostgreSQL data and exchanges identifiers and DTOs across service boundaries. See [service boundaries](service-boundaries.md) and [database ownership](database-ownership.md).

Use REST when the caller needs a response to proceed, such as Learning resolving users through Tenant. Services publish events through Kafka for asynchronous work, such as Achievement & Reporting issuing a certificate after Learning completes an enrollment. See [asynchronous event delivery](event-driven.md).
