# LearnUP Docker Deployment Report (Phase B)

**Date**: 2026-10-13  
**Status**: Completed & Verified  
**Branch**: `develop`  
**Execution Objective**: Full containerized deployment of the LearnUP system via a single command:
```bash
docker compose up --build
```

---

## 1. Executive Summary

Phase B implementation of the LearnUP containerization plan has been executed and verified in the local Docker environment.

All **13 containers** (8 application microservices, API Gateway, Eureka Server, Apache Kafka, PostgreSQL, and Web Frontend) build and start cleanly, achieve healthy runtime status, and correctly interconnect without host collisions.

### Key Verification Highlights:
- **Single-command startup**: Complete stack boots reproducibly using `docker compose up -d`.
- **Port Conflict Resolution**:
  - API Gateway host mapping standardized to `8088:8080`.
  - PostgreSQL host mapping standardized to `5433:5432` to avoid host collision with local PostgreSQL (PID 8976).
  - Course Service internal port standardized to `8083` (host mapping `8089:8083`).
- **Dual Service Discovery**:
  - Java microservices (`identity-service`, `notification-service`, `audit-service`, `api-gateway`) register with Eureka (`http://eureka-server:8761/eureka/`).
  - NestJS microservices (`tenant-service`, `course-service`, `learning-service`, `assessment-service`, `achievement-reporting-service`) resolve via Docker bridge DNS (`http://<service-name>:<port>`).
- **Database Inventory & Migrations**:
  - All 8 logical databases (`identity_db`, `tenant_db`, `course_db`, `learning_db`, `assessment_db`, `achievement_reporting_db`, `notification_db`, `audit_db`) exist and preserve data.
  - Existing Prisma migrations applied cleanly via container startup entrypoints without schema loss.
  - `achievement-reporting-service` (lacking migrations folder) starts directly without destructive `db push`.
- **Demo Account Seeding & Authentication**:
  - All four canonical accounts (`admin@learnup.local`, `organizer@learnup.local`, `instructor@learnup.local`, `learner@learnup.local`) successfully authenticate through the API Gateway on port 8088.
  - JWT token validation, correlation ID generation, and trusted header forwarding verified end-to-end.
- **Graceful Cloudinary Fallback**:
  - Services boot cleanly without Cloudinary credentials.
  - Cover upload requests return explicit `503 Service Unavailable` (`Unable to upload Course cover`), never pretending that an upload succeeded.
- **Kafka KRaft Infrastructure**:
  - Kafka 7.6.0 operates in KRaft mode (controller quorum) with zero Zookeeper dependency. Topic creation, message production, and consumer poll verified.
- **Persistence Across Restarts**:
  - Full stack stopped with `docker compose down` and restarted with `docker compose up -d`. All data, user accounts, and database relations persisted intact.

---

## 2. Architecture & Service Topology

| Container Name | Service Name | Tech Stack | Internal Port | Host Port | Discovery | Healthcheck | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `learnup-postgres` | PostgreSQL 16 | PostgreSQL Alpine | `5432` | `5433` | Docker DNS | `pg_isready` | **PASS (healthy)** |
| `learnup-kafka` | Apache Kafka | Confluent CP Kafka 7.6.0 | `29092` | `9092`, `29092` | Docker DNS | `kafka-topics --list` | **PASS (healthy)** |
| `learnup-eureka` | Eureka Server | Spring Boot 3.3 / Java 21 | `8761` | `8761` | Self | `wget /eureka/apps` | **PASS (healthy)** |
| `learnup-gateway` | API Gateway | Spring Cloud Gateway | `8080` | `8088` | Eureka + DNS | `wget /actuator/health` | **PASS (healthy)** |
| `learnup-identity-service` | Identity Service | Spring Boot 3.3 / Java 21 | `8081` | `8081` | Eureka (`lb://`) | `wget /actuator/health` | **PASS (healthy)** |
| `learnup-notification-service` | Notification Service | Spring Boot 3.3 / Java 21 | `8082` | `8082` | Eureka (`lb://`) | `wget /actuator/health` | **PASS (healthy)** |
| `learnup-audit-service` | Audit Service | Spring Boot 3.3 / Java 21 | `8083` | `8093` | Eureka (`lb://`) | `wget /actuator/health` | **PASS (healthy)** |
| `learnup-tenant-service` | Tenant Service | NestJS 11 / Node 22 | `8084` | `8084` | Docker DNS | Process Alive | **PASS** |
| `learnup-course-service` | Course Service | NestJS 11 / Node 22 | `8083` | `8089` | Docker DNS | Process Alive | **PASS** |
| `learnup-learning-service` | Learning Service | NestJS 11 / Node 22 | `8085` | `8085` | Docker DNS | Process Alive | **PASS** |
| `learnup-assessment-service` | Assessment Service | NestJS 11 / Node 22 | `8086` | `8086` | Docker DNS | Process Alive | **PASS** |
| `learnup-achievement-reporting-service` | Achievement Reporting | NestJS 11 / Node 22 | `8087` | `8087` | Docker DNS | Process Alive | **PASS** |
| `learnup-web` | Frontend Web App | React / Vite / Nginx | `3000` | `3000` | Browser Host | HTTP 200 | **PASS** |

---

## 3. Changes Made and Files Affected

### 3.1 Orchestration & Environment Configuration
- [docker-compose.yml](file:///d:/Study/learnup/docker-compose.yml): Root multi-container orchestration for all 13 services, environment bindings, volumes (`learnup_postgres_data`, `learnup_kafka_data`), health checks, and restart rules.
- [.env.example](file:///d:/Study/learnup/.env.example): Root development environment template with non-colliding ports (`GATEWAY_HOST_PORT=8088`, `POSTGRES_PORT=5433`).
- [.dockerignore](file:///d:/Study/learnup/.dockerignore): Root ignore file preventing host `node_modules`, `target`, `dist`, `.git`, and IDE metadata from bloating Docker build contexts.

### 3.2 Gateway & Routing
- [gateway/api-gateway/Dockerfile](file:///d:/Study/learnup/gateway/api-gateway/Dockerfile): Multi-stage Maven/JDK build context installing `libraries/java-common` prior to compiling Gateway JAR.
- [gateway/api-gateway/src/main/resources/application.yml](file:///d:/Study/learnup/gateway/api-gateway/src/main/resources/application.yml):
  - Updated routes for NestJS services to use Docker DNS service names and explicit port mappings (`http://tenant-service:8084`, `http://course-service:8083`, `http://learning-service:8085`, `http://assessment-service:8086`, `http://achievement-reporting-service:8087`).
  - Added route prefixes for `/subscription-plans/**`, `/registrations/**`, `/invitations/**`, `/enrollments/**`.
  - Expanded `jwt.whitelist` to include `/api/v1/subscription-plans/**`, `/api/v1/registrations/**`, `/api/v1/invitations/**`.

### 3.3 Database & Seeding
- [infrastructure/postgres/init-databases.sh](file:///d:/Study/learnup/infrastructure/postgres/init-databases.sh): POSIX `/bin/sh` initialization script with LF line endings creating all 8 service databases.
- [infrastructure/postgres/seed-dev-accounts.sql](file:///d:/Study/learnup/infrastructure/postgres/seed-dev-accounts.sql): Idempotent SQL script for provisioning canonical demo accounts, organizations, subscription plans, platform settings, and active subscriptions across `identity_db` and `tenant_db`.
- [services/identity-service/src/main/resources/application.yml](file:///d:/Study/learnup/services/identity-service/src/main/resources/application.yml): Added `spring.flyway.baseline-on-migrate: true` to prevent schema history initialization failure against pre-existing tables.

### 3.4 Storage & Cloudinary Resilience
- [services/tenant-service/src/infrastructure/storage/storage.provider.ts](file:///d:/Study/learnup/services/tenant-service/src/infrastructure/storage/storage.provider.ts): Fallback to `UnconfiguredStorageProvider` returning `503 Service Unavailable` on uploads when Cloudinary credentials are absent.
- [services/course-service/src/infrastructure/storage/storage.provider.ts](file:///d:/Study/learnup/services/course-service/src/infrastructure/storage/storage.provider.ts): Fallback to `UnconfiguredStorageProvider` for course cover and material uploads.
- [services/assessment-service/src/infrastructure/storage/storage.provider.ts](file:///d:/Study/learnup/services/assessment-service/src/infrastructure/storage/storage.provider.ts): Fallback to `UnconfiguredStorageProvider` for assignment attachment uploads.

### 3.5 Service Dockerfiles & Startup Scripts
- [services/identity-service/Dockerfile](file:///d:/Study/learnup/services/identity-service/Dockerfile): Multi-stage build installing `java-common` and building Spring Boot runner.
- [services/notification-service/Dockerfile](file:///d:/Study/learnup/services/notification-service/Dockerfile): Multi-stage build installing `java-common` and building runner.
- [services/audit-service/Dockerfile](file:///d:/Study/learnup/services/audit-service/Dockerfile): Multi-stage build installing `java-common` and building runner.
- [services/tenant-service/Dockerfile](file:///d:/Study/learnup/services/tenant-service/Dockerfile): Multi-stage build copying `ts-common` + `ts-storage`, compiling Prisma client, building NestJS, and deploying migrations on boot.
- [services/course-service/Dockerfile](file:///d:/Study/learnup/services/course-service/Dockerfile): Multi-stage build copying `ts-common` + `ts-storage`, exposing port 8083, running `prisma migrate deploy` on boot.
- [services/learning-service/Dockerfile](file:///d:/Study/learnup/services/learning-service/Dockerfile): Multi-stage build copying `ts-common`, running `prisma migrate deploy` on boot.
- [services/assessment-service/Dockerfile](file:///d:/Study/learnup/services/assessment-service/Dockerfile): Multi-stage build copying `ts-common` + `ts-storage`, exposing port 8086, running `prisma migrate deploy` on boot.
- [services/achievement-reporting-service/Dockerfile](file:///d:/Study/learnup/services/achievement-reporting-service/Dockerfile): Multi-stage build copying `ts-common`, starting directly without migration deploy step.
- [frontend/Dockerfile](file:///d:/Study/learnup/frontend/Dockerfile): Multi-stage Node 22 builder + Nginx Alpine runner serving production SPA on port 3000.
- [frontend/nginx.conf](file:///d:/Study/learnup/frontend/nginx.conf): Nginx configuration with HTML5 history API SPA fallback (`try_files $uri $uri/ /index.html`).

---

## 4. Commands Executed and Verification Results

| # | Command Executed | Exit Code | Observed Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `docker compose config --quiet` | 0 | Valid syntax and configuration across all 13 services | **PASS** |
| 2 | `docker compose build` | 0 | All 11 custom container images built successfully | **PASS** |
| 3 | `docker compose up -d` | 0 | All 13 containers created and started | **PASS** |
| 4 | `docker exec learnup-postgres psql -U postgres -c "\l"` | 0 | Verified all 8 service databases exist in PostgreSQL instance | **PASS** |
| 5 | `curl.exe -s http://localhost:8761/eureka/apps` | 0 | Eureka registered `API-GATEWAY`, `IDENTITY-SERVICE`, `AUDIT-SERVICE`, `NOTIFICATION-SERVICE` with status `UP` | **PASS** |
| 6 | `curl.exe -s http://localhost:8088/actuator/health` | 0 | Gateway returned `{"status":"UP"}` | **PASS** |
| 7 | `curl.exe -s http://localhost:8088/api/v1/subscription-plans` | 0 | Gateway successfully routed to `tenant-service` via Docker DNS | **PASS** |
| 8 | `curl.exe -s -X POST http://localhost:8088/api/v1/auth/login` (admin) | 0 | Logged in as `ADMIN`, received JWT access token | **PASS** |
| 9 | `curl.exe -s -X POST http://localhost:8088/api/v1/auth/login` (organizer) | 0 | Logged in as `ORGANIZER`, received JWT with `organizationId` | **PASS** |
| 10 | `curl.exe -s -X POST http://localhost:8088/api/v1/auth/login` (instructor) | 0 | Logged in as `INSTRUCTOR`, received JWT with `organizationId` | **PASS** |
| 11 | `curl.exe -s -X POST http://localhost:8088/api/v1/auth/login` (learner) | 0 | Logged in as `LEARNER`, received JWT with `organizationId` | **PASS** |
| 12 | `curl.exe -s http://localhost:8088/api/v1/auth/me` (Bearer JWT) | 0 | Verified JWT validation & trusted header forwarding through Gateway | **PASS** |
| 13 | `curl.exe -s -I http://localhost:3000` | 0 | Frontend Nginx returned `HTTP/1.1 200 OK` | **PASS** |
| 14 | `kafka-topics --create` / producer / consumer | 0 | KRaft cluster created topic, produced, and consumed message | **PASS** |
| 15 | `curl.exe -X POST .../courses/cover` (No Cloudinary) | 0 | Returned explicit `HTTP 503 Service Unavailable` | **PASS** |
| 16 | `docker compose down` && `docker compose up -d` | 0 | Full restart; all accounts, plans, and databases persisted | **PASS** |

---

## 5. Detailed Verification Findings

### 5.1 All Eight Databases Verification
All eight microservices connect to their designated logical database within the `learnup-postgres` container:

1. **`identity_db`** (Owner: `identity-service`):
   - Tables: `users`, `refresh_tokens`, `flyway_schema_history`
   - Flyway baselined version 1 successfully.
2. **`tenant_db`** (Owner: `tenant-service`):
   - Tables: `organizations`, `subscription_plans`, `subscriptions`, `users`, `account_tokens`, `registrations`, `payments`, `platform_settings`, `organization_suspensions`, `outbox_events`, `_prisma_migrations`
   - Migrations applied: `20260930074521_init_tenant_schema`, `20260930131551_fix_subscription_partial_index`, `20261006070154_add_email_otp_verification`.
3. **`course_db`** (Owner: `course-service`):
   - Tables: `courses`, `modules`, `lessons`, `materials`, `media_files`, `course_chains`, `content_reports`, `organization_quota_locks`, `outbox_events`, `platform_settings`, `_prisma_migrations`
   - Migrations applied: `20260930125513_init_course`.
4. **`learning_db`** (Owner: `learning-service`):
   - Tables: `enrollments`, `enrollment_status_intervals`, `material_progress`, `learner_accounts`, `course_version_snapshots`, `lesson_snapshots`, `material_snapshots`, `organization_suspensions`, `outbox_events`, `platform_settings`, `_prisma_migrations`
   - Migrations applied: `20260930015700`, `20260930165505_add_design_constraints`.
5. **`assessment_db`** (Owner: `assessment-service`):
   - Tables: `assessments`, `submissions`, `submission_reviews`, `submission_review_scores`, `rubric_criteria`, `peer_review_cycles`, `quizzes`, `quiz_questions`, `quiz_question_options`, `quiz_attempts`, `quiz_attempt_answers`, `learner_assessment_states`, `completed_enrollments`, `learner_accounts`, `outbox_events`, `platform_settings`, `_prisma_migrations`
   - Migrations applied: `20260930084438_assessment`.
6. **`achievement_reporting_db`** (Owner: `achievement-reporting-service`):
   - Dedicated database exists and is connected. Started cleanly without migrations per approved decision.
7. **`notification_db`** (Owner: `notification-service`):
   - Tables: `notifications`, `notification_templates`, `email_logs`, `flyway_schema_history`
   - Flyway baselined version 1 successfully.
8. **`audit_db`** (Owner: `audit-service`):
   - Tables: `audit_logs`, `flyway_schema_history`
   - Flyway baselined version 1 successfully.

### 5.2 Gateway and Service Discovery
- API Gateway routes Java microservices dynamically via Eureka using `lb://SERVICE-NAME`.
- API Gateway routes NestJS microservices reliably via internal Docker DNS:
  - `http://tenant-service:8084`
  - `http://course-service:8083`
  - `http://learning-service:8085`
  - `http://assessment-service:8086`
  - `http://achievement-reporting-service:8087`
- Gateway strips incoming `x-user-id`, `x-user-role`, `x-organization-id` from external callers, validates the incoming JWT, and injects authenticated claims to downstream services.

### 5.3 Authentication & Demo Accounts
All four canonical development accounts are provisioned with password `LearnUp@123`:
- **Admin**: `admin@learnup.local` (`01900000-0000-7000-8000-000000000001`) — Role `ADMIN`
- **Organizer**: `organizer@learnup.local` (`01900000-0000-7000-8000-00000000a010`) — Role `ORGANIZER`, Org: `01900000-0000-7000-8000-00000000a001` (Công ty ABC)
- **Instructor**: `instructor@learnup.local` (`01900000-0000-7000-8000-00000000a101`) — Role `INSTRUCTOR`, Org: `01900000-0000-7000-8000-00000000a001`
- **Learner**: `learner@learnup.local` (`01900000-0000-7000-8000-00000000a201`) — Role `LEARNER`, Org: `01900000-0000-7000-8000-00000000a001`

Identity and Tenant database records share identical UUIDs, preserving domain boundaries.

### 5.4 Kafka KRaft Event Broker
- Broker runs Confluent CP Kafka 7.6.0 in KRaft mode (`broker,controller`).
- Advertised listeners configured: `PLAINTEXT://kafka:29092` for container-to-container communication, and `PLAINTEXT_HOST://localhost:9092` for host tooling.
- Cluster verified by creating `learnup.test.topic`, publishing a message, and reading back the message payload.

### 5.5 Cloudinary Behavior
- Cloudinary environment variables (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) default to empty in development.
- Storage providers fallback to `UnconfiguredStorageProvider` on startup.
- Unrelated endpoints operate normally.
- An upload request requiring Cloudinary returns `503 Service Unavailable`:
  ```json
  {
    "statusCode": 503,
    "path": "/api/v1/courses/cover",
    "error": {
      "message": "Unable to upload Course cover.",
      "error": "Service Unavailable",
      "statusCode": 503
    }
  }
  ```

---

## 6. Remaining Limitations & Non-Production Disclaimers

1. **Development Profile Only**:
   - The current configuration uses development defaults (shared secret keys, default demo passwords, and single-replica KRaft broker).
   - Production deployments must supply secure, randomly generated secrets via external secret management (e.g., Vault, AWS Secrets Manager) and configure a multi-broker Kafka cluster with appropriate replication factors.
2. **Mock Inter-Service Client Modes**:
   - `learning-service` defaults to Tenant HTTP access (`LEARNING_TENANT_CLIENT_MODE=http`). Development/performance runs can explicitly set `LEARNING_TENANT_CLIENT_MODE=fake` and `LEARNING_TENANT_FAKE_TIMEZONE=Asia/Ho_Chi_Minh`; fake mode is rejected in production.
3. **Achievement Reporting Migrations**:
   - `achievement-reporting-service` has no checked-in Prisma migration history. When database persistence for this service is activated, a formal initial migration must be created in compliance with migration guardrails.
4. **Email Dispatch**:
   - `notification-service` has mail disabled by default (`LEARNUP_MAIL_ENABLED=false`). Connecting a real SMTP server requires providing credentials in `.env`.

---

## 7. How to Run the System

### 7.1 Quick Start
```bash
# 1. Clone repository and navigate to root
cd learnup

# 2. Build and start all 13 services
docker compose up -d --build

# 3. Check running status
docker compose ps
```

### 7.2 Access URLs
- **Web Frontend**: [http://localhost:3000](http://localhost:3000)
- **API Gateway**: [http://localhost:8088](http://localhost:8088)
- **Eureka Dashboard**: [http://localhost:8761](http://localhost:8761)
- **PostgreSQL**: `localhost:5433` (user: `postgres`, password: `postgres`)
- **Apache Kafka**: `localhost:9092` (internal: `kafka:29092`)

### 7.3 Stopping the System
```bash
# Graceful stop preserving database volumes
docker compose down

# Stop and wipe database volumes (clean slate)
docker compose down -v
```
