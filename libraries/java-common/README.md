# LearnUP Java Common Library (`libraries/java-common`)

Minimal shared technical library for Spring Boot microservices in the LearnUP platform.

---

## 1. Purpose

`java-common` provides foundational, domain-independent technical utilities to avoid duplicate boilerplate across Spring Boot microservices. It encapsulates:
* Trusted Gateway authentication & tenant context extraction
* Standardized REST API response envelopes and pagination models
* Global exception handling and error code mapping
* Asynchronous event envelope contract for Apache Kafka

---

## 2. What the Library Contains

```text
com.learnup.common/
├── context/
│   ├── CurrentUser.java              # Static accessor for user identity and role
│   ├── OrganizationContext.java      # Static accessor for organization/tenant ID
│   ├── CorrelationContext.java       # Static accessor for correlation ID context
│   ├── RequestContext.java           # Immutable context model
│   ├── RequestContextHolder.java     # ThreadLocal context manager
│   ├── HeaderConstants.java          # Header constants (X-User-ID, X-Organization-ID, etc.)
│   └── UserContextFilter.java        # Servlet filter extracting headers and clearing context
├── security/
│   └── UserRole.java                 # Enum: ADMIN, ORGANIZER, INSTRUCTOR, LEARNER
├── response/
│   ├── ApiResponse.java              # Standard envelope { success, data, error }
│   ├── ApiError.java                 # Error details { code, message, details }
│   └── PageResponse.java             # Simple offset pagination { items, page, size, totalElements, ... }
├── exception/
│   ├── ErrorCode.java                # Standard error codes (UNAUTHORIZED, NOT_FOUND, etc.)
│   ├── BusinessException.java        # Domain exception with error codes
│   └── GlobalExceptionHandler.java   # @RestControllerAdvice mapping exceptions to ApiResponse
└── event/
    └── EventEnvelope.java            # Canonical Kafka event envelope matching JSON Schema
```

---

## 3. What the Library Does NOT Contain

To enforce clean service boundaries and prevent domain coupling, this library strictly excludes:
* **No domain entities**: No `User`, `Organization`, `Course`, `Enrollment`, `Assessment`, etc.
* **No database code**: No JPA repositories, DataSource configurations, or SQL migrations.
* **No business logic**: No domain services, authorization rules, or workflow orchestration.
* **No runtime infrastructure**: No Kafka producers/consumers, Eureka clients, or JWT validation engines.

---

## 4. Usage Guide

### 4.1 Authentication & Multi-Tenant Context
Services include `UserContextFilter` in their filter chain (or rely on Spring Boot component scanning). In controllers/services:

```java
// Access authenticated context anywhere in the request thread
UUID userId = CurrentUser.getUserIdAsUuid();
UserRole role = CurrentUser.getRole();
UUID organizationId = OrganizationContext.getOrganizationIdAsUuid();
String correlationId = CorrelationContext.getCorrelationId();

if (CurrentUser.hasRole(UserRole.ORGANIZER)) {
    // Perform organizer-specific logic
}
```

### 4.2 Standard API Responses
```java
// Success Response
@GetMapping("/{id}")
public ApiResponse<CourseDto> getCourse(@PathVariable UUID id) {
    CourseDto course = courseService.findById(id);
    return ApiResponse.success(course);
}

// Paginated Response
@GetMapping
public ApiResponse<PageResponse<LearnerDto>> listLearners(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
    PageResponse<LearnerDto> result = learnerService.findLearners(page, size);
    return ApiResponse.success(result);
}
```

### 4.3 Exception Handling
Throwing a `BusinessException` automatically produces a standardized error envelope with the appropriate HTTP status code:

```java
if (course == null) {
    throw BusinessException.notFound("Course with ID " + id + " does not exist.");
}

if (!course.isPublished()) {
    throw new BusinessException(ErrorCode.CONFLICT, "Cannot assign an unpublished course.");
}
```

### 4.4 Event Envelope for Kafka
```java
EventEnvelope<CourseCompletedPayload> event = EventEnvelope.create(
        "CourseCompleted",
        organizationId,
        "learning-service",
        new CourseCompletedPayload(learnerId, courseId, finalScore)
);
```

---

## 5. Dependency Rules

* Downstream Spring Boot microservices depend on `java-common`.
* `java-common` **must never** depend on any downstream microservice or business domain artifact.
