# Payment Service (`services/payment-service`)

## Technology Stack
* Spring Boot / NestJS
* PostgreSQL (`payment_db`)

## Eureka Application Name
* `PAYMENT-SERVICE`

## Responsibilities
* B2B organization payment processing.
* Payment transaction tracking and status management (`PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`).
* Invoicing and receipt record keeping.

## Database Entities
* `PaymentTransaction` (`id`, `organization_id`, `amount_cents`, `currency`, `status`, `payment_method`, `external_ref`, `created_at`)
* `Invoice` (`id`, `organization_id`, `transaction_id`, `invoice_number`, `issued_at`, `total_amount_cents`)
