# Assessment Service (`services/assessment-service`)

## 1. Overview
* **Service Name**: `assessment-service`
* **Service Classification**: Business Service (4 of 5)
* **Intended Technology**: NestJS (TypeScript)
* **Dedicated Database**: PostgreSQL (`assessment_db`)
* **Eureka Service Identifier**: `ASSESSMENT-SERVICE`
* **Implementation Status**: **Skeleton Only** (Implementation intentionally deferred to the NestJS team)

---

## 2. High-Level Domain Ownership (Source of Truth)
The Assessment Service is the authority for quizzes, exams, and assignment evaluations:
* **Assessment Authoring**: Quiz creation, question banks, answer keys, scoring rubrics.
* **Auto-Grading**: Deterministic real-time evaluation for Multiple-Choice Questions (strictly non-AI).
* **Attempt Constraints**: Maximum attempt limits, time duration limits, anti-cheat retake intervals.
* **Assignment Submissions**: Learner file/essay submissions, instructor manual grading, grade overrides.
* **Grade Records**: Immutable grade histories and evaluation outcomes.

---

## 3. Strict Boundary Rules
* **No Direct Cross-Database Access**: Must never connect directly to other services' databases.
* **Course Structure**: Course syllabus and lesson hierarchy are owned by **Course Service** (`course_db`).
* **Enrollment Progress**: Overall course completion is computed by **Learning Service** (`learning_db`).
* **Deferred Implementation**: Contains no Java/Spring Boot code. Will be implemented independently by the NestJS team.
