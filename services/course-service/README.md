# Course Service (`services/course-service`)

## Technology Stack
* Spring Boot / NestJS
* PostgreSQL (`course_db`)

## Eureka Application Name
* `COURSE-SERVICE`

## Responsibilities
* Course authoring and publishing workflows by Instructors.
* Managing hierarchical syllabus structure: Courses -> Modules -> Lessons.
* Course metadata, descriptions, prerequisites, and resource attachments.

## Database Entities
* `Course` (`id`, `organization_id`, `instructor_id`, `title`, `description`, `thumbnail_url`, `status`, `created_at`)
* `Module` (`id`, `course_id`, `title`, `order_index`)
* `Lesson` (`id`, `module_id`, `title`, `content_type`, `content_url`, `order_index`, `is_free_preview`)
* `CoursePrerequisite` (`id`, `course_id`, `prerequisite_course_id`)

## Anti-Responsibilities
* Does NOT track student progress or enrollments (owned by **Learning Service**).
* Does NOT own quiz questions or exam submissions (owned by **Assessment Service**).
