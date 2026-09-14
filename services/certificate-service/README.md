# Certificate Service (`services/certificate-service`)

## Technology Stack
* Spring Boot / NestJS
* PostgreSQL (`certificate_db`)
* Apache Kafka Consumer

## Eureka Application Name
* `CERTIFICATE-SERVICE`

## Responsibilities
* Listening to `learnup.learning.course-completed` Kafka events.
* Generating unique, cryptographically verifiable certificate records.
* Providing a public verification endpoint (`GET /api/certificates/verify/{certificateCode}`).

## Database Entities
* `CertificateTemplate` (`id`, `organization_id`, `template_name`, `background_url`, `is_default`)
* `Certificate` (`id`, `organization_id`, `learner_id`, `course_id`, `certificate_code`, `issued_at`, `verification_url`, `pdf_url`)
