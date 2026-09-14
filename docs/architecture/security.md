# Authentication, Authorization, & Security Architecture

LearnUP implements a centralized authentication and distributed authorization architecture. The API Gateway acts as the secure entry point that validates cryptographic tokens, while downstream microservices enforce fine-grained Role-Based Access Control (RBAC) and multi-tenant isolation.

---

## 1. Platform Roles

The system strictly supports **exactly four roles**:

```text
┌─────────────────┬─────────────────────────────────────────────────────────────┐
│ Role            │ Primary Responsibilities & Scope                            │
├─────────────────┼─────────────────────────────────────────────────────────────┤
│ ADMIN           │ Platform-wide administration, tenant onboarding, system     │
│                 │ configuration, global oversight.                            │
├─────────────────┼─────────────────────────────────────────────────────────────┤
│ ORGANIZER       │ Organization-level administration: managing learners,       │
│                 │ assigning tags, assigning mandatory courses, tracking KPIs. │
├─────────────────┼─────────────────────────────────────────────────────────────┤
│ INSTRUCTOR      │ Authoring courses, managing syllabus, grading assignments,  │
│                 │ resolving peer review timeouts and grading overrides.       │
├─────────────────┼─────────────────────────────────────────────────────────────┤
│ LEARNER         │ Enrolling in courses, viewing assigned learning, submitting │
│                 │ quizzes/essays, completing peer reviews, earning certs.     │
└─────────────────┴─────────────────────────────────────────────────────────────┘
```

*Rule*: No additional roles shall be introduced without an explicit business justification.

---

## 2. JWT Access Token Structure

Identity Service issues HMAC-SHA256 signed JSON Web Tokens (JWT) upon successful authentication.

```json
{
  "sub": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "role": "ORGANIZER",
  "organizationId": "d8e3b970-13f5-4c07-b2e8-4934a3621415",
  "email": "organizer@techcorp.com",
  "fullName": "Nguyen Van A",
  "iat": 1726310000,
  "exp": 1726317200,
  "iss": "learnup-identity-service"
}
```

* **Multi-Tenancy Key**: `organizationId` is the single canonical tenant identifier. The use of `tenantId` is forbidden to prevent naming ambiguity.

---

## 3. Gateway Security & Header Propagation

```text
                       Client Request
               (Contains Authorization: Bearer JWT)
                             │
                             ▼
                 ┌───────────────────────┐
                 │  Spring Cloud Gateway │
                 └───────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [1. Sanitize Inbound]             [2. Cryptographic Check]
   Strip any client-sent:            - Validate Signature
   - X-User-ID                       - Validate Expiration (exp)
   - X-Organization-ID               - Extract Claims
   - X-User-Role
   - X-Correlation-ID
            │                                 │
            └────────────────┬────────────────┘
                             │
                             ▼
                 [3. Inject Trusted Headers]
                 - X-User-ID: 3fa85f64-5717...
                 - X-Organization-ID: d8e3b970...
                 - X-User-Role: ORGANIZER
                 - X-Correlation-ID: a9c25f10...
                             │
                             ▼
              Forward to Downstream Microservices
```

### Downstream Trust Model:
1. Microservices sit behind the API Gateway on an internal network.
2. Downstream services read user and organization context from the trusted `X-*` headers.
3. Microservices must **never trust** tenant or role IDs sent in request bodies or query parameters when asserting ownership; they must always cross-check against `X-Organization-ID` and `X-User-ID`.

---

## 4. Authorization Enforcement (RBAC)

Authorization logic is decentralized into business microservices:
* **API Gateway**: Validates authentication and token integrity.
* **Business Services**: Validate permissions and tenant boundaries.

```java
// Example in Spring Boot business service using Java Common utilities
@PreAuthorize("hasRole('ORGANIZER') or hasRole('ADMIN')")
@PostMapping("/courses/{courseId}/assign")
public ApiResponse<AssignmentResult> assignCourse(
        @PathVariable UUID courseId,
        @RequestBody AssignCourseRequest request,
        @RequestHeader("X-Organization-ID") UUID organizationId) {
    
    return ApiResponse.success(learningService.assignCourse(organizationId, courseId, request));
}
```
