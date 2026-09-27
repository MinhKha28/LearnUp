# Course Service (`services/course-service`)

## 1. Overview
* **Service Name**: `course-service`
* **Service Classification**: Business Service (2 of 5)
* **Intended Technology**: NestJS (TypeScript)
* **Dedicated Database**: PostgreSQL (`course_db`)
* **Eureka Service Identifier**: `COURSE-SERVICE`
* **Implementation Status**: **Skeleton Only** (Implementation intentionally deferred to the NestJS team)

---

## 2. High-Level Domain Ownership (Source of Truth)
The Course Service is the authority for course authoring and curriculum management:
* **Course Master & Versioning**: Course catalog, metadata, version lifecycles (`Draft`, `Submitted`, `Published`, `Rejected`, `Archived`, `Disabled`).
* **Syllabus Hierarchy**: Hierarchical curriculum structure: Courses $\rightarrow$ Modules $\rightarrow$ Lessons.
* **Content Materials**: Lesson content metadata, reading/video resource attachment keys, prerequisites.
* **Course Content Lock**: Irreversible lock on course structure upon the first learner enrollment.
* **Visibility Rules**: Public vs private course classification (`courseType`).

---

## 3. Strict Boundary Rules
* **No Direct Cross-Database Access**: Must never connect directly to other services' databases.
* **Enrollments & Progress**: Student enrollments and completion percentages are owned by **Learning Service** (`learning_db`).
* **Quizzes & Grading**: Assessments, question banks, and submissions are owned by **Assessment Service** (`assessment_db`).
* **Deferred Implementation**: Contains no Java/Spring Boot code. Will be implemented independently by the NestJS team.
