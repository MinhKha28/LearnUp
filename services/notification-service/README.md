# Notification Service (`services/notification-service`)

## Technology Stack
* Spring Boot / NestJS
* PostgreSQL (`notification_db`)
* Apache Kafka Consumer

## Eureka Application Name
* `NOTIFICATION-SERVICE`

## Responsibilities
* Subscribing to domain events across the platform via Kafka (`CourseCompleted`, `RequiredAssignmentCreated`, `PeerReviewAssigned`, etc.).
* Persisting in-app notifications for users.
* Managing user notification preferences and dispatching alerts.

## Database Entities
* `Notification` (`id`, `organization_id`, `recipient_user_id`, `title`, `content`, `type`, `is_read`, `created_at`)
* `NotificationPreference` (`id`, `user_id`, `email_enabled`, `in_app_enabled`)

## Consumed Events
* `learnup.learning.course-completed`
* `learnup.learning.assignment-created`
* `learnup.assessment.peer-review-assigned`
