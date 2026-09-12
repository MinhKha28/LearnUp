# ADR-004: API Gateway & Dynamic Service Discovery

## Status
Accepted

## Context
A microservice architecture requires a single entry point for routing, authentication verification, rate limiting, and dynamic service instance discovery to avoid hardcoded network endpoints and redundant security logic across services.

## Decision
1. **Spring Cloud Gateway** is selected as the unified API Gateway for ingress traffic management, JWT verification, and internal header injection.
2. **Netflix Eureka Server** is selected as the central dynamic service discovery registry.
3. Microservices register with Eureka upon startup and communicate internally via discovered service IDs.

## Consequences
- **Positive**: Centralized security perimeter, zero hardcoded downstream IP addresses, robust load-balancing and routing.
- **Negative**: Adds two platform components that must be orchestrated and monitored.
