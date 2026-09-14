# Identity Service (`services/identity-service`)

## Technology Stack
* Java 21, Spring Boot 3.x
* Spring Security, Spring Data JPA
* PostgreSQL (`identity_db`)
* Flyway Migrations
* JWT (jjwt / Nimbus)

## Port & Eureka Name
* Port: `8081`
* Eureka Application Name: `IDENTITY-SERVICE`

## Responsibilities
* User authentication (Username/Email & Password).
* Password hashing using BCrypt.
* Issuing signed JWT access tokens containing `sub`, `role`, and `organizationId`.
* Token refresh flow.
* User account registration and profile retrieval.

## Database Entities
* `User` (`id`, `email`, `password_hash`, `full_name`, `role`, `organization_id`, `created_at`, `updated_at`)
* `RefreshToken` (`id`, `user_id`, `token`, `expires_at`, `revoked`)

## Explicit Anti-Responsibilities
* Does NOT manage organizations or company metadata (owned by **Organization Service**).
* Does NOT manage course assignments, enrollments, or certificates.
