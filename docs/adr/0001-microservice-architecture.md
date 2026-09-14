# ADR 0001: Microservice Architecture with Independent Framework Selection

## Status
Accepted

## Context
LearnUP is a B2B multi-tenant online learning platform designed for a graduation thesis. The system requires clear business boundaries, independent deployment, and realistic microservice engineering practices. Different business domains may benefit from either Java/Spring Boot (type safety, rich enterprise ecosystem) or TypeScript/NestJS (productivity, unified TS typing with frontend).

## Decision
We adopt a microservice architecture where each business service is independently deployable and owns its domain logic and persistent storage. Each business service may independently be implemented using either:
* **Spring Boot (Java 21)**
* **NestJS (TypeScript)**

The infrastructure (API Gateway, Eureka Server, Kafka) and client frontend must remain strictly agnostic to whether a downstream service is implemented in Spring Boot or NestJS.

## Consequences
### Positive:
* Clear domain boundary enforcement.
* Flexibility to implement services in the most suitable language/framework.
* Demonstrates polyglot microservice integration in the graduation thesis.

### Negative:
* Need for minimal common libraries in both Java (`java-common`) and TypeScript (`ts-common`).
* Requires maintaining Docker build configurations for both ecosystems.
