# LearnUP — Minimal but Complete Microservice Platform

LearnUP is a non-AI B2B multi-tenant online learning and corporate training platform built on a clean, decoupled microservice architecture. It demonstrates strict business boundaries, database-per-service isolation, role-based access control, multi-tenant organization boundaries, and balanced synchronous/asynchronous communication.

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
│   ├── kafka/                             # Kafka configuration and topic definitions
│   └── postgres/                          # Multi-database init script (8 isolated service DBs)
│
├── gateway/
│   └── api-gateway/                       # Spring Cloud Gateway (JWT validation & header propagation)
│
├── services/
│   ├── identity-service/                  # Supporting: Credentials, authentication, JWT tokens (identity_db)
│   ├── notification-service/              # Supporting: In-app notifications & email dispatch (notification_db)
│   ├── audit-service/                     # Supporting: Append-only governance and action logs (audit_db)
│   ├── tenant-service/                    # Business: Orgs, user accounts, subscriptions, payments (tenant_db)
│   ├── course-service/                    # Business: Courses, versions, syllabus, lessons (course_db)
│   ├── learning-service/                  # Business: Enrollments, learning progress, required assignments (learning_db)
│   ├── assessment-service/                # Business: Quizzes, submissions, grading, peer reviews (assessment_db)
│   └── achievement-reporting-service/     # Business: Certificates, analytics, reports, governance (achievement_reporting_db)
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
├── docker-compose.yml                     # Local orchestration of PostgreSQL, Kafka, Eureka, and platform components
└── README.md
```

---

## 3. Technology Stack & Boundaries

### Platform & Supporting Components
| Component | Technology | Database | Key Responsibilities |
| :--- | :--- | :--- | :--- |
| **Frontend** | ReactJS + TS + Vite | N/A | Auth state, protected routes, role UI, Org context |
| **API Gateway** | Spring Cloud Gateway | None | Reverse proxy, JWT verify, `X-*` header propagation |
| **Service Discovery** | Spring Cloud Eureka | None | Service registry & health monitoring |
| **Event Bus** | Apache Kafka | None | Asynchronous business event broadcast |
| **Identity Service** | Spring Boot (Java 21) | `identity_db` (Postgres) | Credentials, password hashing, JWT issuing, login |
| **Notification Service** | Spring Boot (Java 21) | `notification_db` (Postgres) | In-app notifications, email dispatch, alert templates |
| **Audit Service** | Spring Boot | `audit_db` (Postgres) | Append-only governance audit logs, actor/resource action history |

### 5 Finalized Business Services
| Business Service | Database | Key Responsibilities |
| :--- | :--- | :--- |
| **Tenant Service** | `tenant_db` | Master User/Account records, Organizations, members, tags, plans, subscriptions, payments |
| **Course Service** | `course_db` | Course catalog, course versioning, syllabus, modules, lessons, material links |
| **Learning Service** | `learning_db` | Course enrollments, lesson progress tracking, required course assignments |
| **Assessment Service** | `assessment_db` | Quizzes, assignments, submissions, auto-grading, instructor/peer reviews |
| **Achievement & Reporting Service** | `achievement_reporting_db` | Certificates, learning analytics, organization compliance reports, governance |

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
     - x-internal-key: <INTERNAL_SERVICE_KEY>                │
 └──────────────────────────────┬──────────────────────────────┘
                                │
               ┌────────────────┼────────────────┐
               │                │                │
               ▼                ▼                ▼
        Identity Service   Supporting       5 Business
                           Services          Services
```

---

## 5. System Decisions & Architecture Exclusions

LearnUP intentionally maintains clean, robust boundaries without unnecessary technical complexity. See [`docs/adr/`](file:///d:/Study/learnup/docs/adr) for full decision records.

* **Exactly 4 Authenticated Roles**: `ADMIN`, `ORGANIZER`, `INSTRUCTOR`, `LEARNER` (Guest is unauthenticated, not a role).
* **Single Tenant Identifier**: `organizationId` is the single canonical tenant key.
* **Database-per-Service**: 8 independent logical databases with zero cross-service direct DB access or foreign keys.
* **Synchronous REST + Asynchronous Kafka**: REST for direct queries/commands; Kafka for decoupled domain event broadcasts.
* **Zero AI / ML / LLM Functionality**: AI grading, AI tutors, LLM APIs, and vector embeddings are completely excluded.
* **Explicitly Excluded Technologies**: Redis, RabbitMQ, Kubernetes, OpenTelemetry, Prometheus, Grafana, CQRS, Event Sourcing, 2PC Distributed Transactions, Database RLS, Service Mesh, Config Server, Elasticsearch, Next.js, Azure Blob / Azurite.
