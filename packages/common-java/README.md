# LearnUP Common Java Library (`common-java`)

Reusable, technology-neutral Java 21 / Spring Boot library for **cross-cutting concerns** across the LearnUP platform.

---

## 1. Features & Capabilities

- **JWT Parsing & Validation**: Cryptographically verify tokens, parse claims (`sub`, `role`, `organizationId`, `iat`, `exp`), and map to `CurrentUser`.
- **Tenant Context (`TenantContext`)**: ThreadLocal propagation and isolation of `organizationId`.
- **CurrentUser Abstraction**: Role and permission checks (`isAdmin()`, `isOrganizer()`, `isInstructor()`, `isLearner()`).
- **Standard API Envelopes**: `ApiResponse<T>`, `ApiError`, `PageMeta`, `PageResponse<T>`.
- **Rich Exception Hierarchy**: `BusinessException`, `ResourceNotFoundException`, `ForbiddenException`, `ConflictException`, `UnauthorizedException`, `InvalidInputException`.
- **Global Exception Handler**: Spring `@RestControllerAdvice` mapping all platform and framework exceptions to standardized `ApiError` responses.
- **Pagination Utilities (`PaginationUtils`)**: Clamping, offset calculations, list slicing, and `PageMeta` creation.
- **Request Correlation (`CorrelationIdFilter`)**: MDC propagation and HTTP header forwarding of `X-Correlation-ID`.
- **Structured Logging (`StructuredLogHelper`)**: Automated JSON logging contextualization (`organizationId`, `userId`, `correlationId`, `service`).
- **Kafka Event Publisher (`EventPublisher`)**: Generic event publisher with CloudEvent-compatible `GenericEventEnvelope<T>` envelope wrapping.
- **Spring Boot 3 Auto-Configuration**: Automatic bean registration via `CommonAutoConfiguration`.

---

## 2. Maven Installation

Add the dependency to your microservice `pom.xml`:

```xml
<dependency>
    <groupId>com.learnup</groupId>
    <artifactId>common-java</artifactId>
    <version>1.0.0-SNAPSHOT</version>
</dependency>
```

---

## 3. Usage Examples

### 3.1 Tenant Context & Current User

```java
import com.learnup.common.auth.CurrentUser;
import com.learnup.common.context.SecurityContextHolder;
import com.learnup.common.context.TenantContext;

// Access the active tenant organization ID
String orgId = TenantContext.requireOrganizationId();

// Access authenticated user details and check roles
CurrentUser currentUser = SecurityContextHolder.requireCurrentUser();
if (currentUser.isOrganizer()) {
    // Perform organizer actions
}
```

---

### 3.2 Standard API Responses & Pagination

```java
import com.learnup.common.api.ApiResponse;
import com.learnup.common.api.PageResponse;
import com.learnup.common.api.PaginationUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class ExampleController {

    @GetMapping("/api/v1/items")
    public ApiResponse<List<String>> getItems(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        List<String> items = List.of("Item A", "Item B", "Item C");
        PageResponse<String> paginated = PaginationUtils.paginateList(items, page, size);
        
        return ApiResponse.ok(paginated.getItems(), paginated.getMeta());
    }
}
```

---

### 3.3 Throwing Standard Platform Exceptions

```java
import com.learnup.common.exception.ResourceNotFoundException;
import com.learnup.common.exception.ForbiddenException;
import com.learnup.common.exception.ConflictException;

// Resource not found (HTTP 404)
throw new ResourceNotFoundException("Course", courseId);

// Forbidden access (HTTP 403)
throw new ForbiddenException("Only instructors can publish courses", "INSTRUCTOR");

// Conflict error (HTTP 409)
throw new ConflictException("User", "email", email);
```

---

### 3.4 Publishing Kafka Events

```java
import com.learnup.common.event.EventPublisher;
import com.learnup.common.context.TenantContext;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ExampleEventService {

    private final EventPublisher eventPublisher;

    public ExampleEventService(EventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }

    public void emitEvent(String userId, String email) {
        String orgId = TenantContext.requireOrganizationId();
        Map<String, String> payload = Map.of("userId", userId, "email", email);

        eventPublisher.publish(
                "learnup.identity.user-registered.v1",
                "identity.user.registered",
                orgId,
                null,
                payload
        );
    }
}
```

---

### 3.5 Structured Logging with MDC

```java
import com.learnup.common.logging.StructuredLogHelper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ExampleLoggingService {

    private static final Logger log = LoggerFactory.getLogger(ExampleLoggingService.class);

    public void executeBackgroundJob(String orgId, String userId, String corrId) {
        StructuredLogHelper.withContext(orgId, userId, corrId, () -> {
            log.info("Starting background synchronization job");
            // Perform job logic with automatic MDC context
        });
    }
}
```

---

### 3.6 JWT Parsing & Validation

```java
import com.learnup.common.auth.JwtParser;
import com.learnup.common.auth.JwtValidator;
import com.learnup.common.auth.CurrentUser;

JwtParser parser = new JwtParser("your_256_bit_secret_key_here_12345678");
JwtValidator validator = new JwtValidator(parser);

if (validator.isValid(rawToken)) {
    CurrentUser user = parser.parseCurrentUser(rawToken);
    System.out.println("Authenticated user: " + user.getUserId() + " in org: " + user.getOrganizationId());
}
```
