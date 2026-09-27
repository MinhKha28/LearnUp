# Achievement & Reporting Service (`services/achievement-reporting-service`)

## 1. Overview
* **Service Name**: `achievement-reporting-service`
* **Service Classification**: Business Service (5 of 5)
* **Intended Technology**: NestJS (TypeScript)
* **Dedicated Database**: PostgreSQL (`achievement_reporting_db`)
* **Eureka Service Identifier**: `ACHIEVEMENT-REPORTING-SERVICE`
* **Implementation Status**: **Skeleton Only** (Implementation intentionally deferred to the NestJS team)

---

## 2. High-Level Domain Ownership (Source of Truth)
The Achievement & Reporting Service is the authority for credentials, evaluations, and compliance reports:
* **Verifiable Certificates**: Certificate generation upon receiving course completion events, unique verification codes, tamper-evident verification portal.
* **Training Evaluations**: Post-course surveys, feedback questionnaires, learner ratings.
* **Learning Analytics**: Aggregated completion statistics, cohort progress analytics, score distributions.
* **Compliance Reporting**: Organization compliance reporting for enterprise administrators.

---

## 3. Strict Boundary Rules
* **No Direct Cross-Database Access**: Must never connect directly to other services' databases.
* **Completion Evaluation**: Course completion calculation is owned by **Learning Service** (`learning_db`).
* **Audit Trail Storage**: Security and compliance event logging is owned by **Audit Service** (`audit_db`).
* **Deferred Implementation**: Contains no Java/Spring Boot code. Will be implemented independently by the NestJS team.
