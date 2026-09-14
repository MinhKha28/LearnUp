# Subscription Service (`services/subscription-service`)

## Technology Stack
* Spring Boot / NestJS
* PostgreSQL (`subscription_db`)

## Eureka Application Name
* `SUBSCRIPTION-SERVICE`

## Responsibilities
* Managing organization subscription plans, tiers (Standard, Pro, Enterprise), and validity periods.
* Managing seat quotas and feature entitlement rules.
* Providing REST verification endpoints for seat and feature availability.

## Database Entities
* `Plan` (`id`, `name`, `code`, `max_learners`, `max_courses`, `price_cents`, `billing_cycle`)
* `OrganizationSubscription` (`id`, `organization_id`, `plan_id`, `start_date`, `end_date`, `status`)
* `FeatureEntitlement` (`id`, `plan_id`, `feature_key`, `is_enabled`, `numeric_limit`)
