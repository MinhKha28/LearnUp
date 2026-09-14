# LearnUP — Minimal but Complete Microservice Platform

LearnUP is a B2B multi-tenant online learning platform built on a clean, decoupled microservice architecture. It demonstrates strict business boundaries, database-per-service isolation, role-based access control, multi-tenant organization boundaries, and balanced synchronous/asynchronous communication.

---

## 1. Architectural Highlights

* **Architecture Pattern**: Microservices with Database-per-Service.
* **Frontend**: ReactJS, TypeScript, Vite, React Router, Axios (No Next.js).
* **API Gateway**: Spring Cloud Gateway (Routing, JWT validation, Security context propagation, CORS, Correlation IDs).
* **Service Discovery**: Netflix Eureka Server (Infrastructure service discovery without business logic).
* **Identity & Authentication**: Identity Service (JWT access token issuance, Spring Security, BCrypt hashing).
* **Multi-Tenancy Model**: Single `organizationId` identifier enforced across all tenant-aware services.
* **Service Framework Agnosticism**: Business services implemented independently using **Spring Boot (Java 21)** or **NestJS (TypeScript)**.
* **Synchronous Communication**: REST over HTTP via Eureka discovery.
* **Asynchronous Messaging**: Apache Kafka for domain/business event broadcasting (standard event envelope).
* **Containerization**: Docker & Docker Compose for local development.

---

## 2. Monorepo Directory Structure

```text
learnup/
│
├── frontend/
│   └── web/                               # ReactJS + Vite + TypeScript frontend foundation
│
├── infrastructure/
│   ├── eureka-server/                     # Spring Cloud Netflix Eureka discovery server
│   └── kafka/                             # Kafka configuration and topic definitions
│
├── gateway/
│   └── api-gateway/                       # Spring Cloud Gateway (JWT validation & header propagation)
│
├── services/
│   ├── identity-service/                  # User identity, authentication, JWT issuing (identity_db)
│   ├── organization-service/              # Organizations, members, tags, learner groups (organization_db)
│   ├── subscription-service/              # Organization subscriptions and plans (subscription_db)
│   ├── payment-service/                   # B2B payments and invoices (payment_db)
│   ├── course-service/                    # Courses, modules, lessons, content metadata (course_db)
│   ├── learning-service/                  # Enrollments, learning progress, required assignments (learning_db)
│   ├── assessment-service/                # Quizzes, MCQ auto-grading, submissions, peer reviews (assessment_db)
│   ├── certificate-service/               # Certificate issuance and verification (certificate_db)
│   ├── specialization-service/            # Course specializations & tracks (specialization_db)
│   ├── recommendation-service/            # Course & learning recommendations (recommendation_db)
│   └── notification-service/              # Event-driven user notifications (notification_db)
│
├── libraries/
│   ├── java-common/                       # Shared Java technical utilities (security, response, exception)
│   └── ts-common/                         # Shared TS utilities (HTTP client, context, shared types)
│
├── contracts/
│   ├── openapi/                           # OpenAPI 3.0 API specifications
│   └── events/                            # JSON schemas and examples for Kafka domain events
│
├── docs/
│   ├── architecture/                      # Architectural specifications and diagrams
│   ├── business/                          # Business requirements and domain rules
│   ├── api/                               # REST API standards and conventions
│   └── adr/                               # Architecture Decision Records (ADRs)
│
├── docker-compose.yml                     # Local orchestration of database, Kafka, Eureka, and services
└── README.md
```

---

## 3. Technology Stack & Boundaries

| Component | Technology | Database | Key Responsibilities |
| :--- | :--- | :--- | :--- |
| **Frontend** | ReactJS + TS + Vite | N/A | Auth state, protected routes, role UI, Org context |
| **API Gateway** | Spring Cloud Gateway | None | Reverse proxy, JWT verify, `X-*` header propagation |
| **Service Discovery** | Spring Cloud Eureka | None | Service registry & health monitoring |
| **Event Bus** | Apache Kafka | None | Asynchronous business event broadcast |
| **Identity Service** | Spring Boot (Java 21) | `identity_db` (Postgres) | Users, roles, credentials, JWT issuing |
| **Organization Service** | Spring Boot (Java 21) | `organization_db` (Postgres) | Orgs, memberships, tags, bulk learner selection |
| **Business Services** | Spring Boot / NestJS | Dedicated Postgres DBs | Domain logic, isolated data ownership |

---

## 4. Security & Context Propagation Flow

```text
 Client (ReactJS)
       │
       │ HTTP Request with Authorization: Bearer <JWT>
       ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                    Spring API Gateway                       │
 │  1. Strip incoming client-spoofed X-User-*, X-Org-* headers │
 │  2. Validate JWT signature, expiration, and issuer          │
 │  3. Extract sub (userId), role, organizationId              │
 │  4. Inject trusted headers & forward:                       │
 │     - X-User-ID: <sub (user-id)>                            │
 │     - X-Organization-ID: <organization-id>                  │
 │     - X-User-Role: <ADMIN | ORGANIZER | INSTRUCTOR | LEARNER>│
 │     - X-Correlation-ID: <uuid>                              │
 └──────────────────────────────┬──────────────────────────────┘
                                │
               ┌────────────────┼────────────────┐
               │                │                │
               ▼                ▼                ▼
        Identity Service   Org Service    Business Services
```

---

## 5. Implementation Roadmap (Phased Execution)

* **[x] P0 — Architecture Foundation**: Monorepo foundation, ADRs, service boundaries, communication rules, data ownership.
* **[x] P1 — Java Common Library**: Minimal technical utilities (`CurrentUser`, `OrganizationContext`, `ApiResponse`, exceptions).
* **[ ] P2 — TypeScript Common Library**: Framework-neutral TS utilities (Context, HTTP clients, standard types).
* **[ ] P3 — Eureka Server**: Service discovery server setup and health verification.
* **[ ] P4 — API Gateway**: Spring Cloud Gateway routing, JWT validation filter, header propagation, CORS.
* **[ ] P5 — Identity Service**: User entity, Spring Security, BCrypt, JWT generation, `identity_db`.
* **[ ] P6 — ReactJS Foundation**: Authentication context, login/logout, route guards, Gateway integration.
* **[ ] P7 — Kafka Infrastructure**: Event envelope producer/consumer abstractions and error handling.
* **[ ] P8 — Organization Service**: Organizations, memberships, learner tags, search/filter, `organization_db`.
* **[ ] P9 — Platform Integration**: End-to-end authentication, authorization, REST routing, and event verification.
* **[ ] P10 — Business Services**: Incremental implementation of Subscription, Payment, Course, Learning, Assessment, Certificate, Specialization, Recommendation, Notification.

---

## 6. Architecture Decisions & Exclusions

LearnUP intentionally avoids unnecessary complexity. See [`docs/adr/`](file:///d:/Study/learnup/docs/adr) for full decision records.

**Explicitly Excluded Technologies**:
Redis, RabbitMQ, Kubernetes, OpenTelemetry, Prometheus, Grafana, CQRS, Event Sourcing, Saga, Transactional Outbox, Database RLS, Service Mesh, Config Server, Elasticsearch.
