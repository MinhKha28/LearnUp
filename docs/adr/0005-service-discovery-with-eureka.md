# ADR 0005: Service Discovery with Spring Cloud Netflix Eureka

## Status
Accepted

## Context
Microservice instances in containerized or local development environments receive dynamic IP addresses. Services need a reliable, standard mechanism to discover endpoint locations without hardcoded hosts or ports.

## Decision
We use **Spring Cloud Netflix Eureka Server** as the central service registry:
1. Microservices register their service name and health status with Eureka upon startup.
2. Spring Cloud Gateway dynamically resolves routes via `lb://<SERVICE-NAME>`.
3. Inter-service REST calls resolve target addresses using Eureka discovery.
4. Eureka is strictly an infrastructure service: it contains no business data, no user management, and no business logic.

## Consequences
### Positive:
* Eliminates hardcoded service URLs.
* Integrates seamlessly with Spring Cloud Gateway.
* Standardized, well-understood discovery pattern.

### Negative:
* Requires running a dedicated Eureka Server container.
