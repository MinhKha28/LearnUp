# Tenant Service (`services/tenant-service`)

## 1. Overview
* **Service Name**: `tenant-service`
* **Service Classification**: Business Service (1 of 5)
* **Intended Technology**: NestJS (TypeScript)
* **Dedicated Database**: PostgreSQL (`tenant_db`)
* **Eureka Service Identifier**: `TENANT-SERVICE`
* **Implementation Status**: **Skeleton Only** (Implementation intentionally deferred to the NestJS team)

---

## 2. High-Level Domain Ownership (Source of Truth)
The Tenant Service is the authority for multi-tenancy and primary account master data:
* **Canonical User / Account Master**: Generates and owns canonical `user_id`, user profiles, organization memberships, and status.
* **Organization Management**: Organization lifecycle, settings, profile details, enterprise configurations.
* **Invitations & Cohort Tagging**: Member invitations, email verification tokens, learner tags/cohort classifications.
* **Commercial Subscriptions & Billing**: Subscription pricing plans, active subscription lifecycles, seat limits, storage quota policy enforcement, payment transactions, and invoices.

---

## 3. Strict Boundary Rules
* **No Direct Cross-Database Access**: Must never connect directly to `identity_db`, `course_db`, `learning_db`, `assessment_db`, `achievement_reporting_db`, `notification_db`, or `audit_db`.
* **Credentials Separation**: User credentials, password hashing, refresh tokens, and JWT issuance are owned exclusively by **Identity Service** (`identity_db`).
* **Deferred Implementation**: Contains no Java/Spring Boot code. Will be implemented independently by the NestJS team.
