# Service Boundaries & Domain Catalog

This document defines the strict functional boundaries, database ownership, and non-responsibilities for all platform and business services in the LearnUP architecture.

---

## 1. Service Catalog Matrix

### Supporting Services
| Service | Database | Key Responsibilities | Framework Choice |
| :--- | :--- | :--- | :--- |
| **Identity Service** | `identity_db` | User credentials, authentication, password hashing, JWT tokens, refresh tokens | Spring Boot (Java 21) |
| **Notification Service** | `notification_db` | In-app notifications, user alerts, direct email dispatching, notification templates | Spring Boot (Java 21) |
| **Audit Service** | `audit_db` | Append-only governance audit log, actor/target action history, correlation IDs | Spring Boot |

### 5 Finalized Business Services
| Service | Database | Key Responsibilities | Framework Choice |
| :--- | :--- | :--- | :--- |
| **Tenant Service** | `tenant_db` | User/Account master (`user_id`), Organizations, memberships, tags, plans, subscriptions, payments | Spring Boot / NestJS |
| **Course Service** | `course_db` | Course metadata, versions, syllabus, modules, lessons, material references | Spring Boot / NestJS |
| **Learning Service** | `learning_db` | Enrollments, progress tracking, required course assignments, compliance deadlines | Spring Boot / NestJS |
| **Assessment Service** | `assessment_db` | Quizzes, assignments, auto-grading, submissions, instructor grading, peer review workflow | Spring Boot / NestJS |
| **Achievement & Reporting Service** | `achievement_reporting_db` | Certificates, verification keys, learning analytics, compliance reports, governance decision logging | Spring Boot / NestJS |

---

## 2. Detailed Service Boundaries & Anti-Responsibilities

### 2.1 Identity Service (Supporting)
* **Owns**: User credentials (`user_id`, `password_hash`), login authentication, token refresh, token issuance (`JWT`), Google login linkage, recovery codes.
* **Responsibilities**: Authentication, credential verification, JWT issuance.
* **Must NOT Own**:
  * User profile details (`fullName`, `avatarUrl`, etc.) or organization membership (owned by **Tenant Service**).
  * Subscription quotas, courses, enrollments, assessments, or certificates.

### 2.2 Tenant Service (Business)
* **Owns**: `UserAccount` (generates canonical `user_id`), `Organization`, `Membership`, `LearnerProfile`, `InstructorProfile`, `Tag`, `LearnerTag`, `Plan`, `Subscription`, `FeatureQuota`, `PaymentTransaction`, `Invoice`.
* **Responsibilities**:
  * User account master lifecycle and profile management.
  * Organization lifecycle and member management.
  * Custom tags for grouping learners (e.g., department, cohort).
  * Subscription plans, tier limits, seat allowances, storage quota enforcement policies, and B2B payment transactions.
* **Must NOT Own**:
  * User credentials or password hashes (owned by **Identity Service**).
  * Course content or syllabus (owned by **Course Service**).

### 2.3 Course Service (Business)
* **Owns**: `Course`, `CourseVersion`, `Module`, `Lesson`, `ResourceAttachmentRef`, `CoursePrerequisite`.
* **Responsibilities**:
  * Course authoring, course versioning, syllabus hierarchy, and draft/publish workflows.
  * Course Content Lock (locked irreversibly upon the first enrollment).
* **Must NOT Own**:
  * Student enrollment records or progress percentages (owned by **Learning Service**).
  * Quizzes, question banks, or grading (owned by **Assessment Service**).

### 2.4 Learning Service (Business)
* **Owns**: `Enrollment` (`REQUIRED` / `OPTIONAL`), `LearningProgress`, `LessonCompletion`, `RequiredCourseAssignment`.
* **Responsibilities**:
  * Learner course enrollment and lesson completion tracking (7 lifecycle states).
  * Halting enrollments upon `CourseDisabled` events.
  * Required course assignments assigned to individual or tagged groups of learners.
  * Learning deadlines and compliance tracking.
* **Must NOT Own**:
  * Course syllabus structure or content definitions (owned by **Course Service**).
  * Quiz question creation or rubric evaluation (owned by **Assessment Service**).
  * Tag definitions or learner directory search (owned by **Tenant Service**).

### 2.5 Assessment Service (Business)
* **Owns**: `Assessment`, `Question`, `Option`, `Submission`, `Answer`, `PeerReviewAssignment`, `PeerReviewEvaluation`, `InstructorGradeOverride`.
* **Responsibilities**:
  * Deterministic MCQ automated scoring based on answer keys (strictly non-AI).
  * Essay / assignment submission handling.
  * Peer review assignment, submission workflow, and fallback to instructor grading on review timeouts.
* **Must NOT Own**:
  * Overall course progress tracking or certificate issuance.
  * Course syllabus structure (owned by **Course Service**).

### 2.6 Achievement & Reporting Service (Business)
* **Owns**: `Certificate`, `CertificateTemplate`, `VerificationRecord`, `LearningAnalyticsSnapshot`, `ComplianceReport`, `GovernanceDecision`.
* **Responsibilities**:
  * Certificate generation upon receiving course completion events.
  * Public certificate verification.
  * Aggregated learning progress analytics, compliance reporting for organization admins.
  * Recording administrative governance decisions while delegating domain state mutation to owning services.
* **Must NOT Own**:
  * Directly updating another service's database tables. Domain mutations are executed by the owning domain service.

### 2.7 Notification Service (Supporting)
* **Owns**: In-app notification center (`Notification`), notification templates (`NotificationTemplate`), and email dispatching logs (`EmailLog`).
* **Responsibilities**:
  * Delivering in-app notifications and transactional emails based on subscribed domain events.
* **Must NOT Own**:
  * User credentials or account profiles.
  * Business state mutation.

### 2.8 Audit Service (Supporting)
* **Owns**: Append-only audit records (`AuditLog`), actor metadata, organization context, action types, target resource references, correlation IDs.
* **Responsibilities**:
  * Recording immutable event trails for security and compliance.
* **Must NOT Own**:
  * Domain state mutations.
  * Direct database access to other service databases.
