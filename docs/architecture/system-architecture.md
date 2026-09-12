# LearnUP System Architecture

## 1. Executive Overview

**LearnUP** is an enterprise-grade B2B multi-tenant online learning platform designed to support scalable organizational workforce development, continuous education, and certified learning pathways. 

The architecture is built on a **modular microservice topology** orchestrated around:
- **Centralized API Gateway & Service Discovery**: Spring Cloud Gateway and Netflix Eureka providing secure ingress, authentication offloading, routing, and dynamic load balancing.
- **Polyglot Backend Ecosystem**: Spring Boot as the default/preferred enterprise foundation, with NestJS fully supported for I/O-intensive or rapid-iteration services.
- **Strict Multi-Tenant Isolation**: Tenant boundary isolation anchored strictly around `organizationId`.
- **Event-Driven Asynchronous Messaging**: Apache Kafka handling domain events with unified CloudEvent-compatible envelope schemas and idempotency guarantees.
- **Polyglot Persistence with Database-per-Service**: Independent PostgreSQL schemas/databases per service, Redis for caching/invalidation, and future object storage abstractions.

---

## 2. C4 Architecture Models

### 2.1 System Context (C4 Level 1)

```mermaid
C4Context
    title System Context Diagram - LearnUP Platform

    Person(learner, "Learner", "Enterprise employee participating in courses and assessments.")
    Person(instructor, "Instructor", "Course author creating educational content and grading.")
    Person(organizer, "Organizer", "Enterprise admin managing organizational users and subscriptions.")
    Person(admin, "Platform Admin", "LearnUP super-admin managing platform operations.")

    Enterprise_Boundary(learnup_boundary, "LearnUP B2B Multi-Tenant Platform") {
        System(learnup_system, "LearnUP Microservice Platform", "Delivers multi-tenant courseware, assessments, live sessions, and certifications.")
    }

    System_Ext(mail_provider, "Notification Provider", "External email/SMS delivery gateway.")
    System_Ext(payment_gateway, "Payment Provider", "External payment processor for B2B billing.")
    System_Ext(idp, "Enterprise IdP", "Corporate SSO (SAML 2.0 / OIDC) for enterprise tenants.")

    Rel(learner, learnup_system, "Consumes learning content, takes quizzes via", "HTTPS")
    Rel(instructor, learnup_system, "Authors curriculum, grades assignments via", "HTTPS")
    Rel(organizer, learnup_system, "Manages org seat allocation & analytics via", "HTTPS")
    Rel(admin, learnup_system, "Administers platform operations via", "HTTPS")

    Rel(learnup_system, mail_provider, "Dispatches emails & alerts via", "REST API")
    Rel(learnup_system, payment_gateway, "Processes subscription payments via", "REST API / Webhooks")
    Rel(learnup_system, idp, "Federates tenant identity via", "OIDC / SAML")
```

---

### 2.2 Container Diagram (C4 Level 2)

```mermaid
C4Container
    title Container Diagram - LearnUP Architectural Baseline

    Person(user, "Client Users", "Learners, Instructors, Organizers, Admins")

    System_Boundary(frontend_tier, "Client Tier") {
        Container(web_app, "Web Client (Future)", "Next.js / TypeScript", "Server-rendered & SPA interface for multi-tenant web access.")
    }

    System_Boundary(gateway_tier, "Edge & Routing Tier") {
        Container(gateway, "Spring Cloud Gateway", "Spring Boot / Java", "Ingress traffic controller, JWT validation, header sanitization, header injection (X-User-ID, X-Organization-ID, X-Correlation-ID).")
        Container(eureka, "Eureka Discovery Server", "Spring Cloud Netflix", "Dynamic service registry and heartbeat monitoring.")
    }

    System_Boundary(platform_tier, "Platform Tier") {
        Container(identity_svc, "Identity Service", "Spring Boot", "User identity, credentials, authentication, JWT token generation, role verification.")
    }

    System_Boundary(business_tier, "Business Services Tier (Decoupled Bounded Contexts - Future)") {
        Container(future_svc_1, "Organization Service", "TBD (Spring Boot / NestJS)", "Tenant management, org policies, workspaces.")
        Container(future_svc_2, "Course Service", "TBD (Spring Boot / NestJS)", "Curriculum, modules, lessons, video metadata.")
        Container(future_svc_3, "Learning Service", "TBD (Spring Boot / NestJS)", "Progress tracking, enrollments, bookmarks.")
        Container(future_svc_4, "Assessment Service", "TBD (Spring Boot / NestJS)", "Quizzes, exams, grading, submissions.")
        Container(future_svc_5, "Other Future Services", "TBD (Spring Boot / NestJS)", "Payment, Subscription, Certificate, Recommendation, Notification, Specialization.")
    }

    System_Boundary(data_tier, "Infrastructure & Persistence Tier") {
        ContainerDb(postgres, "PostgreSQL Cluster", "PostgreSQL 16", "Dedicated database/schema per service. Partitioned by organizationId.")
        ContainerDb(redis, "Redis Cache", "Redis 7", "Distributed cache, session blacklist, rate limiter token buckets.")
        ContainerDb(kafka, "Kafka Message Broker", "Apache Kafka KRaft", "Asynchronous domain event streaming across bounded contexts.")
    }

    Rel(user, web_app, "Interacts via", "HTTPS")
    Rel(web_app, gateway, "Sends API requests to", "JSON / HTTPS")

    Rel(gateway, eureka, "Discovers service instances via", "HTTP")
    Rel(gateway, identity_svc, "Routes /api/v1/auth requests to", "HTTP / REST")
    Rel(gateway, future_svc_1, "Routes /api/v1/organizations to", "HTTP / REST")
    Rel(gateway, future_svc_2, "Routes /api/v1/courses to", "HTTP / REST")
    Rel(gateway, future_svc_3, "Routes /api/v1/learning to", "HTTP / REST")
    Rel(gateway, future_svc_4, "Routes /api/v1/assessments to", "HTTP / REST")

    Rel(identity_svc, postgres, "Reads/Writes user credentials", "JDBC / PostgreSQL")
    Rel(identity_svc, redis, "Caches token metadata", "RESP")
    Rel(identity_svc, kafka, "Publishes identity events", "Kafka Protocol")

    Rel_Back(future_svc_1, eureka, "Registers with", "HTTP")
    Rel_Back(future_svc_2, eureka, "Registers with", "HTTP")
    Rel_Back(future_svc_3, eureka, "Registers with", "HTTP")
    Rel_Back(future_svc_4, eureka, "Registers with", "HTTP")

    Rel(future_svc_1, kafka, "Publishes / Subscribes", "Kafka Protocol")
    Rel(future_svc_2, kafka, "Publishes / Subscribes", "Kafka Protocol")
    Rel(future_svc_3, kafka, "Publishes / Subscribes", "Kafka Protocol")
    Rel(future_svc_4, kafka, "Publishes / Subscribes", "Kafka Protocol")
```

---

## 3. High-Level Ingress & Data Flow

```
[ Client / Browser (Next.js) ]
              |
              | 1. HTTP Request with `Authorization: Bearer <JWT>`
              v
[ Spring Cloud Gateway ] 
  - Validates JWT signature & expiry
  - Strips any client-supplied `X-User-ID`, `X-Organization-ID` (Anti-spoofing)
  - Extracts `sub` -> Injects `X-User-ID`
  - Extracts `organizationId` -> Injects `X-Organization-ID`
  - Resolves or generates `X-Correlation-ID`
              |
              | 2. Proxies request with validated internal headers
              v
[ Microservice Instance (Spring Boot / NestJS) ]
  - Security/Tenant Filter binds `organizationId` & `userId` to execution context
  - Service executes domain operation scoped strictly to `organizationId`
  - Emits domain event (if state changed) wrapped in generic Kafka envelope
              |
              +--------------------------+
              |                          |
              v                          v
      [ PostgreSQL ]               [ Apache Kafka ]
  (Scoped by organizationId)      (Broadcasts generic event envelope)
```

---

## 4. Architectural Taxonomy & Classifications

To ensure disciplined governance, the entire codebase is partitioned into 5 unambiguous classifications:

1. **Architectural Decisions**: ADRs and engineering principles governing the platform.
2. **Contracts**: OpenAPI 3.0 reusable component schemas and AsyncAPI/JSON Schema event envelopes.
3. **Infrastructure**: Backing services (PostgreSQL, Kafka, Kafka UI, Redis) managed via Docker Compose.
4. **Platform Services**: Foundation services (Eureka Server, Spring Cloud Gateway, Identity Service) required for system operation.
5. **Future Business Services**: Domain-specific services (Course, Learning, Assessment, etc.) documented strictly by name, bounded context, and interface boundary, without pre-committing technologies or domain models in P0.
