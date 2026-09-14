# Assessment Service (`services/assessment-service`)

## Technology Stack
* Spring Boot / NestJS
* PostgreSQL (`assessment_db`)
* Apache Kafka Producer & Consumer

## Eureka Application Name
* `ASSESSMENT-SERVICE`

## Responsibilities
* Assessment authoring (Quizzes, Exams, Essay / Free-response assignments).
* Automated grading for Multiple-Choice Questions (MCQ) based on internal answer keys.
* Peer review management for essay submissions:
  * Distributing submissions to 5 peer reviewers.
  * Enforcing rule: Learner's own submission requirement is satisfied only when completing 5 peer evaluations.
  * Review timeout detection and automated task routing to Instructors for grading intervention.
* Instructor grade overrides.
* Publishing `learnup.assessment.passed` and `learnup.assessment.peer-review-assigned` Kafka events.

## Database Entities
* `Assessment` (`id`, `organization_id`, `course_id`, `title`, `type`, `passing_score`, `peer_review_count`, `review_timeout_hours`)
* `Question` (`id`, `assessment_id`, `prompt`, `question_type`, `points`, `order_index`)
* `Option` (`id`, `question_id`, `text`, `is_correct`)
* `Submission` (`id`, `assessment_id`, `learner_id`, `status`, `final_score`, `submitted_at`)
* `PeerReviewAssignment` (`id`, `submission_id`, `reviewer_learner_id`, `status`, `score`, `feedback`, `due_at`)
* `InstructorReviewTask` (`id`, `submission_id`, `instructor_id`, `reason`, `status`, `assigned_at`)
