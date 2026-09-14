# Specialization Service (`services/specialization-service`)

## Technology Stack
* Spring Boot / NestJS
* PostgreSQL (`specialization_db`)

## Eureka Application Name
* `SPECIALIZATION-SERVICE`

## Responsibilities
* Grouping individual courses into multi-course specializations and learning tracks.
* Defining track milestones, sequential order, and prerequisite requirements.

## Database Entities
* `Specialization` (`id`, `organization_id`, `title`, `description`, `status`)
* `SpecializationCourse` (`id`, `specialization_id`, `course_id`, `sequence_order`)
