# Service Boundaries & Domain Catalog

This document defines the strict functional boundaries, database ownership, and non-responsibilities for all services in the LearnUP platform.

---

## 1. Service Catalog Matrix

| Service | Database | Key Responsibilities | Framework Choice |
| :--- | :--- | :--- | :--- |
| **Identity Service** | `identity_db` | User identity, credentials, authentication, JWT tokens | Spring Boot (Java 21) |
| **Organization Service** | `organization_db` | Organizations, memberships, instructors, learners, tags | Spring Boot (Java 21) |
| **Subscription Service** | `subscription_db` | Organization plans, tiers, feature limits, subscriptions | Spring Boot / NestJS |
| **Payment Service** | `payment_db` | B2B payment transactions, billing history, invoices | Spring Boot / NestJS |
| **Course Service** | `course_db` | Course metadata, syllabus, modules, lessons, attachments | Spring Boot / NestJS |
| **Learning Service** | `learning_db` | Enrollments, progress tracking, required course assignments | Spring Boot / NestJS |
| **Assessment Service** | `assessment_db` | Quizzes, MCQ auto-grading, submissions, peer review workflow | Spring Boot / NestJS |
| **Certificate Service** | `certificate_db` | Certificate issuance, verifiable verification keys, templates | Spring Boot / NestJS |
| **Specialization Service**| `specialization_db`| Career tracks, course grouping, prerequisite tracking | Spring Boot / NestJS |
| **Recommendation Service**| `recommendation_db`| Recommendation rules, suggested courses by role/tag | Spring Boot / NestJS |
| **Notification Service** | `notification_db` | In-app alerts, email notifications triggered by Kafka events | Spring Boot / NestJS |

---

## 2. Detailed Service Boundaries & Anti-Responsibilities

### 2.1 Identity Service
* **Owns**: User accounts (`User`), platform roles (`Role`), password hashes (`BCrypt`), Refresh Tokens.
* **Responsibilities**: User registration, login authentication, token refresh, token issuance (`JWT`).
* **Must NOT Own**:
  * Organizations, organization membership, or employee metadata.
  * Course assignments, enrollments, grades, certificates, payments, tags.

### 2.2 Organization Service
* **Owns**: `Organization`, `Membership`, `LearnerProfile`, `InstructorProfile`, `Tag`, `LearnerTag`.
* **Responsibilities**:
  * Organization lifecycle management.
  * Member invitations and role assignments within an organization.
  * Custom tag creation (e.g., "Sinh viên IT kỳ 4", "Kinh tế kỳ 2").
  * Tagging learners and filtering learners by tags or search terms for bulk operations.
* **Must NOT Own**:
  * Course assignment records or learning deadlines (owned by **Learning Service**).
  * Courses and modules (owned by **Course Service**).
  * User credentials or password hashes (owned by **Identity Service**).

### 2.3 Subscription Service
* **Owns**: `Plan`, `Subscription`, `FeatureLimit`, `OrganizationSubscription`.
* **Responsibilities**: Pricing tiers, seat allowances, plan validity dates, quota verification.
* **Must NOT Own**: Payment gateway processing or credit card token storage.

### 2.4 Payment Service
* **Owns**: `PaymentTransaction`, `Invoice`, `PaymentMethodReference`.
* **Responsibilities**: B2B checkout, transaction status, invoice generation.
* **Must NOT Own**: Subscription feature enforcement or user profiles.

### 2.5 Course Service
* **Owns**: `Course`, `Module`, `Lesson`, `ResourceAttachment`, `CoursePrerequisite`.
* **Responsibilities**: Course catalog creation, draft/publish workflow, syllabus hierarchy.
* **Must NOT Own**:
  * Student enrollment records or learning progress percentages (owned by **Learning Service**).
  * Student test submissions or grading (owned by **Assessment Service**).

### 2.6 Learning Service
* **Owns**: `Enrollment`, `LearningProgress`, `LessonCompletion`, `RequiredCourseAssignment`.
* **Responsibilities**:
  * Student enrollment in courses.
  * Lesson completion and progress calculation.
  * Required course assignments assigned by Organizers to individual or bulk learners (e.g. 50 learners).
  * Overdue learning tracking and compliance deadlines.
* **Must NOT Own**:
  * Course syllabus structure or video assets (owned by **Course Service**).
  * Quiz question creation or rubric evaluation (owned by **Assessment Service**).
  * Tag definitions or learner directory search (owned by **Organization Service**).

### 2.7 Assessment Service
* **Owns**: `Assessment`, `Question`, `Option`, `Submission`, `Answer`, `PeerReviewAssignment`, `PeerReviewEvaluation`, `InstructorGradeOverride`.
* **Responsibilities**:
  * MCQ automated grading based on answer key.
  * Essay / free-response submission handling.
  * Peer review workflow (e.g., each learner must complete 5 peer reviews to satisfy submission requirements).
  * Review timeout detection and fallback routing to Instructor review tasks.
* **Must NOT Own**:
  * Overall course progress or certificate generation.

### 2.8 Certificate Service
* **Owns**: `Certificate`, `CertificateTemplate`, `VerificationRecord`.
* **Responsibilities**:
  * Generating verifiable certificates upon receiving `CourseCompleted` or `SpecializationCompleted` Kafka events.
  * Public verification API.
* **Must NOT Own**: Course completion business logic or exam grading.

### 2.9 Specialization Service
* **Owns**: `Specialization`, `SpecializationCourseItem`, `CareerTrack`.
* **Responsibilities**: Curating sequences of courses into learning paths and tracks.
* **Must NOT Own**: Individual course authoring or enrollment tracking.

### 2.10 Recommendation Service
* **Owns**: `RecommendationRule`, `LearnerRecommendationSnapshot`.
* **Responsibilities**: Suggesting relevant courses based on learner tags, department, or popular trends.
* **Must NOT Own**: User profiles or enrollment transactions.

### 2.11 Notification Service
* **Owns**: `Notification`, `NotificationPreference`, `DeliveryLog`.
* **Responsibilities**:
  * Listening to Kafka events (`CourseCompleted`, `PeerReviewAssigned`, `RequiredAssignmentCreated`).
  * Dispatching in-app notifications and email alerts.
* **Must NOT Own**: Domain business triggers or user authentication credentials.
