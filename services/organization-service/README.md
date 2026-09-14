# Organization Service (`services/organization-service`)

## Technology Stack
* Java 21, Spring Boot 3.x
* Spring Data JPA
* PostgreSQL (`organization_db`)
* Flyway Migrations

## Port & Eureka Name
* Port: `8082`
* Eureka Application Name: `ORGANIZATION-SERVICE`

## Responsibilities
* Organization lifecycle management (creation, profile, status).
* Organization membership management (associating users with organizations).
* Custom learner tagging (e.g. "Sinh viên IT kỳ 4", "Kinh tế kỳ 2").
* Querying and filtering learners by organization, search term, and tags for bulk operations.
* Providing REST endpoints for other microservices to resolve learner cohorts.

## Database Entities
* `Organization` (`id`, `name`, `code`, `status`, `created_at`)
* `Membership` (`id`, `organization_id`, `user_id`, `role`, `status`)
* `LearnerProfile` (`id`, `organization_id`, `user_id`, `full_name`, `email`, `student_code`)
* `Tag` (`id`, `organization_id`, `name`, `color_code`, `created_at`)
* `LearnerTag` (`id`, `learner_id`, `tag_id`, `assigned_at`)

## Core APIs
* `GET /api/organizations/{id}`
* `GET /api/organizations/{id}/learners` (Supports pagination, search filter, and `tagId` query parameter)
* `POST /api/organizations/{id}/tags`
* `POST /api/organizations/{id}/learners/{learnerId}/tags`
