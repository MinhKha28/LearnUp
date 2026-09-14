# Recommendation Service (`services/recommendation-service`)

## Technology Stack
* Spring Boot / NestJS
* PostgreSQL (`recommendation_db`)

## Eureka Application Name
* `RECOMMENDATION-SERVICE`

## Responsibilities
* Generating personalized course recommendations based on learner tags, department cohorts, and popular courses.
* Providing recommendation query APIs for learner dashboards.

## Database Entities
* `RecommendationRule` (`id`, `organization_id`, `tag_id`, `recommended_course_id`, `priority_weight`)
* `LearnerRecommendationSnapshot` (`id`, `organization_id`, `learner_id`, `recommended_course_ids`, `generated_at`)
