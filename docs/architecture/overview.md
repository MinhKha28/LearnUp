# System Architecture Overview — LearnUP Platform

LearnUP is a multi-tenant B2B online learning platform engineered to demonstrate a clean microservice architecture with strictly defined service boundaries, decoupled data ownership, role-based security, and predictable cross-service communication patterns.

---

## 1. High-Level Architecture Diagram

```text
                               ┌───────────────────────────┐
                               │    ReactJS Frontend       │
                               │  (Vite + TS + React Router)│
                               └─────────────┬─────────────┘
                                             │
                                     HTTP Requests
                                (Bearer JWT Authorization)
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │     Spring Cloud Gateway  │
                               │  - Strip spoofed headers  │
                               │  - Validate JWT           │
                               │  - Inject X-User-* headers│
                               │  - Correlation ID         │
                               └─────────────┬─────────────┘
                                             │
                       ┌─────────────────────┼─────────────────────┐
                       │ (REST via Eureka)   │ (REST via Eureka)   │ (REST via Eureka)
                       ▼                     ▼                     ▼
             ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
             │ Identity Service │  │Supporting Services│ │5 Business Services│
             │  (Spring Boot)   │  │(Media,Audit,Email)│  │ (Spring / NestJS)│
             └─────────┬────────┘  └─────────┬────────┘  └─────────┬────────┘
                       │                     │                     │
                       ▼                     ▼                     ▼
                 [identity_db]          [media/audit]         [service_db]
                                             │
                                             │ REST (via Eureka)
                                             ▼
                                      [Other Services]

         ─────────────────────────────────────────────────────────────────
         INFRASTRUCTURE COMPONENTS (No Business Logic / No Business Data)

             ┌───────────────────────┐             ┌───────────────────────┐
             │     Eureka Server     │             │     Apache Kafka      │
             │   Service Discovery   │             │   Async Event Bus     │
             └───────────────────────┘             └───────────────────────┘
```

---

## 2. Core Architectural Principles

### 2.1 Microservice Independence & Boundaries
* Major business subdomains are partitioned into 5 finalized business services + platform/supporting services.
* Framework agnosticism: Each business service may independently use **Spring Boot (Java 21)** or **NestJS (TypeScript)**.
* No service implementation framework impacts API Gateway, Eureka, or Kafka.

### 2.2 Database Ownership (Database-per-Service)
* Every service owns its dedicated PostgreSQL logical database (8 isolated databases total).
* Zero cross-service database querying.
* Zero cross-service foreign keys.
* Zero cross-service JPA/ORM entities.
* Foreign entities are referenced strictly by opaque identifiers (`organizationId`, `userId`, `courseId`, `learnerId`).

### 2.3 Synchronous vs. Asynchronous Communication Rule

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Use REST when:                                                        │
│  Service A requires an immediate response or query result from B.      │
│  (e.g., Learning Service queries Org & Commercial for learner tags)    │
├────────────────────────────────────────────────────────────────────────┤
│  Use Kafka when:                                                       │
│  Service A announces an event occurred, and multiple downstream        │
│  services independently react in the background.                      │
│  (e.g., CourseCompleted -> Achievement & Reporting & Email Service)    │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Service Discovery with Eureka
* Netflix Eureka manages dynamic service instance registration and heartbeat monitoring.
* Eureka is purely discovery/lookup infrastructure, **not a request-processing hop**.
* Downstream callers discover targets by `service-name` without hardcoded hosts or ports.

### 2.5 Multi-Tenant Data Isolation
* `organizationId` is the universal, exclusive tenant identifier across the platform.
* Multi-tenancy is verified on the backend for every request. Frontend state is untrusted.

---

## 3. Request Lifecycle & Security Propagation

1. **Client Interaction**: ReactJS client issues an HTTP request containing `Authorization: Bearer <JWT>`.
2. **Gateway Interception**:
   * API Gateway strips any client-provided `X-User-ID`, `X-Organization-ID`, `X-User-Role`, or `X-Correlation-ID` headers to prevent header spoofing.
   * Gateway verifies JWT signature and claims (`sub`, `role`, `organizationId`).
   * Gateway creates/propagates `X-Correlation-ID` for end-to-end request tracing.
   * Gateway forwards request with trusted downstream headers:
     * `X-User-ID`: Subject UUID
     * `X-Organization-ID`: Tenant organization UUID
     * `X-User-Role`: User's primary role (`ADMIN`, `ORGANIZER`, `INSTRUCTOR`, `LEARNER`)
     * `X-Correlation-ID`: Trace UUID
3. **Business & Supporting Service Execution**:
   * Downstream service consumes trusted headers via context utilities (`java-common` or `ts-common`).
   * Service verifies role-based authorization (RBAC) and tenant ownership.
   * Service executes business logic against its own database.
   * If cross-domain data is needed synchronously, it makes a REST call using Eureka discovery.
   * If a domain state change occurs, it publishes a versioned event to Kafka using the standard event envelope.
