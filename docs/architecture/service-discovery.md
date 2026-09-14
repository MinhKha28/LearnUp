# Service Discovery with Netflix Eureka

LearnUP uses **Spring Cloud Netflix Eureka** to provide dynamic service registration and lookup. This decouples microservices from physical IP addresses and ephemeral container ports.

---

## 1. Eureka Server Responsibilities

### What Eureka Server DOES:
* Maintains a dynamic registry of active service instances and their endpoints.
* Monitors service instance health via periodic heartbeats.
* Resolves service names (e.g. `ORGANIZATION-SERVICE`, `COURSE-SERVICE`) to live network locations.
* Provides the API Gateway with dynamic routing destinations via `lb://<SERVICE-NAME>`.

### What Eureka Server MUST NOT Do:
* Eureka contains **no business data**.
* Eureka contains **no business logic**.
* Eureka does **not** authenticate users or evaluate security tokens.
* Eureka does **not** proxy payload data or mediate messaging.

---

## 2. Service Registration Conventions

### 2.1 Service Naming Standard
All services register with a predictable, upper-case service name matching their artifact identity:
* `IDENTITY-SERVICE`
* `ORGANIZATION-SERVICE`
* `SUBSCRIPTION-SERVICE`
* `PAYMENT-SERVICE`
* `COURSE-SERVICE`
* `LEARNING-SERVICE`
* `ASSESSMENT-SERVICE`
* `CERTIFICATE-SERVICE`
* `SPECIALIZATION-SERVICE`
* `RECOMMENDATION-SERVICE`
* `NOTIFICATION-SERVICE`

### 2.2 Spring Boot Configuration
In Spring Boot services (`application.yml`):
```yaml
spring:
  application:
    name: organization-service

eureka:
  client:
    service-url:
      defaultZone: ${EUREKA_CLIENT_SERVICEURL_DEFAULTZONE:http://localhost:8761/eureka/}
    register-with-eureka: true
    fetch-registry: true
  instance:
    prefer-ip-address: true
    instance-id: ${spring.application.name}:${random.uuid}
```

### 2.3 NestJS Service Discovery Strategy
For business services written in NestJS:
* Services use a lightweight Eureka client library (e.g., `eureka-js-client`) or environment-configured gateway routing.
* The registration registers the service with Eureka on startup and sends heartbeats.
* When calling another service, the NestJS service resolves the target service endpoint either via Eureka registry lookup or delegates via the internal gateway route.

---

## 3. Spring Cloud Gateway Dynamic Routing

The Spring Cloud Gateway leverages Eureka service discovery to dynamically route traffic without static host mappings:

```yaml
spring:
  cloud:
    gateway:
      discovery:
        locator:
          enabled: false  # Explicit route definitions are used for security and control
      routes:
        - id: organization-service-route
          uri: lb://ORGANIZATION-SERVICE
          predicates:
            - Path=/api/organizations/**
          filters:
            - AuthenticationFilter
```
