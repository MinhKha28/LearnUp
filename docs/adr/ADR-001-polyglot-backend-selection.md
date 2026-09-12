# ADR-001: Polyglot Backend Selection (Spring Boot & NestJS)

## Status
Accepted

## Context
LearnUP is an enterprise B2B online learning platform requiring robust transactional integrity, strong typing, and high reliability for core domains (identity, billing, curriculum, grading), while also needing flexibility for high-throughput I/O aggregations and rapid frontend-aligned services.

## Decision
1. **Spring Boot (Java 21)** is chosen as the **primary and preferred backend technology** across the platform.
2. **NestJS (TypeScript / Node.js)** is chosen as a **fully supported secondary technology** for lightweight, real-time, or I/O-intensive microservices.
3. Technology decisions for future business services are intentionally **not finalized in P0**; they will be evaluated per service against the technology decision matrix.
4. Shared contracts and common libraries (`packages/common-java` and `packages/common-ts`) will enforce platform-wide consistency.

## Consequences
- **Positive**: Combines enterprise Spring ecosystem maturity with Node.js async agility; avoids forcing a single stack where suboptimal.
- **Negative**: Requires maintaining two common library stacks and polyglot container tooling.
- **Mitigation**: Strict adherence to OpenAPI schemas, CloudEvent envelope standards, and uniform HTTP headers.
