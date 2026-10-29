# OpenAPI Contracts & Specifications

This directory holds hand-written OpenAPI 3.0 / Swagger contracts for LearnUP integrations.

---

## Service Contracts Organization

### Available Specifications

* `learning-service.yaml`
* `assessment-service.yaml`
* `achievement-reporting-service.yaml`

## Scope

This folder holds cross-service (internal) contracts and the endpoints other teams integrate against. Every other endpoint is documented by each NestJS service's runtime Swagger UI at `/docs` (JSON at `/docs-json`, the framework default) when the service runs.

Contracts here are hand-written and must be updated in the same PR as the code change. Removing, renaming or retyping a field that another service or the frontend reads is a breaking contract change: add the `contract` label and complete the PR template's "Breaking contract changes" section.

All APIs follow the conventions defined in [`docs/api/conventions.md`](../../docs/api/conventions.md).
