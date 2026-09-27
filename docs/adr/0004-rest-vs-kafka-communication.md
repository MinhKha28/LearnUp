# ADR 0004: Synchronous REST vs Asynchronous Kafka Communication

## Status
Accepted

## Context
Microservices need to communicate to fulfill business use cases. Overusing synchronous REST creates tight runtime coupling and cascading outages, while overusing asynchronous messaging (Kafka) for standard request/response queries adds unnecessary latency and state coordination overhead.

## Decision
We establish a strict division between synchronous REST and asynchronous Kafka:

1. **Use REST** for:
   * Synchronous CRUD operations and immediate queries.
   * Scenarios where caller needs an immediate result or blocking validation (e.g. Learning Service querying Organization Service for learner tags).
   * Service discovery resolved dynamically via Netflix Eureka.

2. **Use Kafka** for:
   * Domain event broadcasting (e.g., `CourseCompleted`, `RequiredAssignmentCreated`, `PeerReviewSubmitted`).
   * Asynchronous background processing where producer does not wait for a response.
   * Multi-consumer event dissemination (e.g., Achievement & Reporting Service and Email Service reacting to course completion).

3. **Explicit Exclusion**:
   * Do NOT use Kafka for CRUD requests or synchronous request-reply emulation.

## Consequences
### Positive:
* Clear mental model for developers.
* Minimizes distributed system complexity while maintaining decoupling where it matters.
