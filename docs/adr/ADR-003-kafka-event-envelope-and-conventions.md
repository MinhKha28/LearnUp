# ADR-003: CloudEvent-Compatible Kafka Event Envelope & Messaging Conventions

## Status
Accepted

## Context
Asynchronous event-driven communication across polyglot microservices (Spring Boot / NestJS) requires a consistent envelope structure so that consumers can perform generic auditing, tracing, tenant routing, and idempotency checks before invoking domain handlers.

## Decision
1. All Kafka events must adhere to a standardized CloudEvent-compatible JSON schema envelope containing `id`, `source`, `type`, `specversion`, `datacontenttype`, `time`, `organizationId`, `correlationId`, and `data`.
2. Topic naming convention is strictly `learnup.<domain>.<event-name>.v<version>`.
3. Default partition key is `organizationId` to guarantee in-order delivery per tenant organization.
4. Consumers must implement idempotency checks against `id`.
5. In P0, only the generic event envelope is defined; domain-specific event schemas are deferred to service implementation phases.

## Consequences
- **Positive**: Uniform event handling, straightforward cross-service tracing, and structured schema evolution across Java and TypeScript services.
- **Negative**: Slight serialization overhead from envelope metadata.
