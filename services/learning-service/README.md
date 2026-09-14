# Learning Service (`services/learning-service`)

## Technology Stack
* Spring Boot / NestJS
* PostgreSQL (`learning_db`)
* Apache Kafka Producer & Consumer

## Eureka Application Name
* `LEARNING-SERVICE`

## Responsibilities
* Course enrollments (voluntary self-enrollment).
* Mandatory/Required Course Assignments created by Organizers for cohorts (e.g., 50 learners).
* Lesson completion tracking and course progress percentage calculation.
* Overdue assignment monitoring.
* Publishing `learnup.learning.course-completed` and `learnup.learning.assignment-created` Kafka events.

## Database Entities
* `Enrollment` (`id`, `organization_id`, `learner_id`, `course_id`, `enrolled_at`, `status`, `progress_percent`)
* `LessonProgress` (`id`, `enrollment_id`, `lesson_id`, `is_completed`, `completed_at`)
* `RequiredCourseAssignment` (`id`, `organization_id`, `course_id`, `learner_id`, `assigned_by`, `assigned_at`, `due_date`, `status`)

## Interactions
* **Sync REST**: Calls `Organization Service` to validate/fetch learner cohorts if required.
* **Async Kafka**: Publishes `CourseCompleted` when progress hits 100%. Listens to `AssessmentPassed` from Assessment Service.
