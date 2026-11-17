# ADR 0008 · Docker DNS for business services

Partially supersedes ADR 0005 ([Eureka service discovery](0005-service-discovery-with-eureka.md)).

## Status

Accepted

## Context

The Gateway routes to Java supporting services and five NestJS business services in the Compose network.

## Decision

Use Eureka and explicit `lb://` Gateway routes for Identity, Notification and Audit. Use configured URLs for Tenant, Course, Learning, Assessment and Achievement & Reporting. The [Gateway route configuration](../../gateway/api-gateway/src/main/resources/application.yml) defaults these URLs to Docker service names and container ports.

## Consequences

Business routes depend on configured URLs and Docker DNS in Compose. Eureka provides instance discovery for the Java supporting routes.
