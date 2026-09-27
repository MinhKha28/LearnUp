# ADR 0007: Explicit Exclusions of Unnecessary Distributed System Technologies

## Status
Accepted

## Context
Graduation thesis projects often suffer from accidental complexity when too many distributed system technologies and architectural patterns are introduced without genuine need. A clear boundary of what is intentionally excluded ensures maintainability and focuses on core domain requirements.

## Decision
The following technologies and architectural patterns are **explicitly excluded** from the initial LearnUP architecture:

* **Redis**: In-memory caching/session clustering is not needed; JWT is stateless and PostgreSQL suffices for persistence.
* **RabbitMQ**: Kafka is the sole messaging infrastructure.
* **Kubernetes**: Local orchestration uses Docker Compose; K8s is unnecessary overhead.
* **OpenTelemetry / Prometheus / Grafana**: Basic correlation ID logging is sufficient; full APM observability is out of scope.
* **CQRS / Event Sourcing**: Standard relational CRUD models per service suffice.
* **Saga Orchestrators / Distributed Transactions**: Business flows are modeled as independent, idempotent domain milestones.
* **Transactional Outbox Engine**: Basic producer retries are sufficient.
* **Database Row-Level Security (RLS)**: Application-level tenant filtering per service is standard.
* **Service Mesh (Istio/Linkerd)**: API Gateway + Eureka discovery provides sufficient routing and discovery.
* **Spring Cloud Config Server**: Environment variables and standard configuration files suffice.
* **Elasticsearch**: PostgreSQL indexing and search capabilities are adequate for the initial scope.
* **Artificial Intelligence & LLMs**: All AI functionality (AI grading, AI content generation, AI tutors, LLMs, external AI APIs) is explicitly excluded from the product scope.

## Consequences
### Positive:
* Drastically reduced operational and cognitive complexity.
* Focuses effort on domain modeling, API contracts, RBAC, and clean microservice boundaries.
* Reliable local execution with minimal resource footprint.
