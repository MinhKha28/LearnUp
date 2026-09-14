# LearnUP TypeScript Common Library (`@learnup/ts-common`)

Minimal, framework-neutral TypeScript shared library for the LearnUP microservice platform and ReactJS frontend.

> `ts-common` contains shared technical contracts and lightweight utilities only. Business logic remains inside individual services/applications.

---

## 1. Purpose

`@learnup/ts-common` provides shared TypeScript types, interfaces, error codes, header constants, and event envelope schemas across:
* **ReactJS Frontend** (`frontend/web`)
* **NestJS Microservices** (any business services implemented in TypeScript)

---

## 2. Framework-Neutral Architecture Rule

To maintain clean architecture and prevent unintended cross-framework coupling, this library strictly adheres to the **Framework-Neutral** rule:
* **No React dependencies**: Does not import React, React Router, or JSX.
* **No NestJS dependencies**: Does not import `@nestjs/common`, `@nestjs/core`, etc.
* **No HTTP Client dependencies**: Does not import Axios, Fetch wrappers, or Express.
* **No Database or Messaging drivers**: Zero TypeORM, Prisma, Kafka runtime, or Redis.

---

## 3. Package Structure

```text
@learnup/ts-common/
├── src/
│   ├── api/
│   │   ├── errors.ts         # STANDARD_ERROR_CODES & ApiError model
│   │   ├── response.ts       # ApiResponse<T> discriminated union & PageResponse<T>
│   │   └── index.ts
│   ├── auth/
│   │   ├── role.ts           # UserRole type ('ADMIN' | 'ORGANIZER' | 'INSTRUCTOR' | 'LEARNER')
│   │   └── index.ts
│   ├── context/
│   │   ├── headers.ts        # HEADER_NAMES (X-User-ID, X-Organization-ID, etc.)
│   │   ├── context.ts        # RequestContext, CurrentUser, OrganizationContext
│   │   └── index.ts
│   ├── event/
│   │   ├── envelope.ts       # EventEnvelope<T> Kafka event schema contract
│   │   └── index.ts
│   └── index.ts              # Public API barrel export
```

---

## 4. Key Contracts & Types

### 4.1 User Roles
```ts
import { UserRole, isValidUserRole, parseUserRole, USER_ROLES } from '@learnup/ts-common';

// Exactly 4 roles matching backend security
type UserRole = 'ADMIN' | 'ORGANIZER' | 'INSTRUCTOR' | 'LEARNER';

const role = parseUserRole(req.headers['x-user-role']); // 'ORGANIZER' | null
```

### 4.2 Header Constants
```ts
import { HEADER_NAMES } from '@learnup/ts-common';

// HEADER_NAMES.USER_ID         -> 'X-User-ID'
// HEADER_NAMES.ORGANIZATION_ID -> 'X-Organization-ID'
// HEADER_NAMES.USER_ROLE       -> 'X-User-Role'
// HEADER_NAMES.CORRELATION_ID  -> 'X-Correlation-ID'
```

### 4.3 API Response & Pagination
```ts
import {
  ApiResponse,
  PageResponse,
  createSuccessResponse,
  createErrorResponse,
  createPageResponse
} from '@learnup/ts-common';

// Success payload wrapping
const response: ApiResponse<CourseDto> = createSuccessResponse(course);

// Error response
const errorResponse = createErrorResponse('RESOURCE_NOT_FOUND', 'Course not found');

// Pagination
const pageData: PageResponse<LearnerDto> = createPageResponse(learners, page, size, total);
```

### 4.4 Request Context
```ts
import {
  RequestContext,
  CurrentUser,
  createRequestContext,
  createCurrentUser
} from '@learnup/ts-common';

const context: RequestContext = createRequestContext({
  userId: 'user-123',
  organizationId: 'org-456',
  role: 'ORGANIZER',
  correlationId: 'trace-abc-123'
});

const currentUser: CurrentUser = createCurrentUser(context);
// currentUser.isAuthenticated -> true
```

### 4.5 Event Envelope for Kafka
```ts
import { EventEnvelope, createEventEnvelope } from '@learnup/ts-common';

const event: EventEnvelope<CourseCompletedData> = createEventEnvelope({
  eventType: 'CourseCompleted',
  organizationId: 'org-456',
  producer: 'learning-service',
  data: {
    learnerId: 'learner-123',
    courseId: 'course-789',
    finalScore: 95.0
  }
});
```

---

## 5. What the Library Does NOT Contain

* No JWT cryptographic signature validation (handled by **API Gateway**).
* No business authorization checks (handled inside downstream services).
* No state management stores or Redux/Zustand hooks.
* No domain entities or database schemas.

---

## 6. Development & Verification Commands

```bash
# Type check
npm run typecheck

# Run unit test suite (Vitest)
npm test

# Compile TypeScript to dist/
npm run build
```
