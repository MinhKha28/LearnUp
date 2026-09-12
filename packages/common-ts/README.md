# LearnUP Common TypeScript / NestJS Library (`@learnup/common-ts`)

Reusable TypeScript library for **cross-cutting concerns** across LearnUP microservices (NestJS) and web clients (Next.js).

---

## 1. Modular Architecture

```
@learnup/common-ts
├── /auth          # JWT payload, CurrentUser abstraction, @Roles(), RolesGuard
├── /context       # TenantContext (AsyncLocalStorage), @CurrentTenant(), HeaderConstants
├── /response      # ApiResponse<T>, ResponseTransformInterceptor, @SkipResponseTransform()
├── /pagination    # PageMeta, PageResponse<T>, PaginationUtils
├── /exception     # BaseException, BusinessException, ResourceNotFoundException, HttpExceptionFilter
├── /correlation   # CorrelationMiddleware, UUID helpers
├── /logging       # StructuredLogger (JSON), LoggingInterceptor
└── /kafka         # GenericEventEnvelope<T>, EventPublisher, KafkaEventPublisher
```

---

## 2. Installation

```bash
npm install @learnup/common-ts
```

---

## 3. Usage Guide for NestJS Microservices

### 3.1 Global Configuration (`main.ts` & `app.module.ts`)

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  TenantContextInterceptor,
  ResponseTransformInterceptor,
  HttpExceptionFilter,
} from '@learnup/common-ts';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global cross-cutting interceptors & filters
  app.useGlobalInterceptors(
    new TenantContextInterceptor(),
    new ResponseTransformInterceptor(),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT || 8080);
}
bootstrap();
```

```typescript
// app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { CorrelationMiddleware, LoggingInterceptor } from '@learnup/common-ts';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
```

---

### 3.2 Tenant Context & Current User in Controllers

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  CurrentUserDecorator,
  CurrentTenant,
  Roles,
  RolesGuard,
  PlatformRole,
} from '@learnup/common-ts';

@Controller('courses')
@UseGuards(RolesGuard)
export class CourseController {

  @Get()
  listCourses(
    @CurrentTenant() organizationId: string,
    @CurrentUserDecorator() user: CurrentUser,
  ) {
    console.log(`Tenant: ${organizationId}, User: ${user.userId}`);
    return ['Course A', 'Course B'];
  }

  @Get('admin-stats')
  @Roles(PlatformRole.ORGANIZER, PlatformRole.ADMIN)
  getAdminStats(@CurrentUserDecorator() user: CurrentUser) {
    return { managedBy: user.userId };
  }
}
```

---

### 3.3 Pagination Utilities

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { PaginationUtils, PageResponse } from '@learnup/common-ts';

@Controller('lessons')
export class LessonController {

  @Get()
  getLessons(
    @Query('page') page?: number,
    @Query('size') size?: number,
  ): PageResponse<string> {
    const allLessons = ['Lesson 1', 'Lesson 2', 'Lesson 3', 'Lesson 4'];
    return PaginationUtils.paginateArray(allLessons, page, size);
  }
}
```

---

### 3.4 Throwing Standard Exceptions

```typescript
import {
  ResourceNotFoundException,
  ForbiddenException,
  ConflictException,
} from '@learnup/common-ts';

// HTTP 404
throw new ResourceNotFoundException('Course', courseId);

// HTTP 403
throw new ForbiddenException('Only instructors may publish lessons', 'INSTRUCTOR');

// HTTP 409
throw new ConflictException('User', 'email', email);
```

---

### 3.5 Publishing Kafka Events

```typescript
import { Injectable } from '@nestjs/common';
import { EventPublisher, TenantContext } from '@learnup/common-ts';

@Injectable()
export class CourseEventService {
  constructor(private readonly eventPublisher: EventPublisher) {}

  async notifyCoursePublished(courseId: string, title: string) {
    const orgId = TenantContext.requireOrganizationId();

    await this.eventPublisher.publish(
      'learnup.course.course-published.v1',
      'course.course-published',
      orgId,
      undefined,
      { courseId, title },
    );
  }
}
```

---

## 4. Usage in Next.js Frontend Applications

Next.js frontend applications import framework-neutral contracts directly:

```typescript
import {
  ApiResponse,
  ApiError,
  PageResponse,
  PlatformRole,
} from '@learnup/common-ts';

async function fetchCourses(): Promise<PageResponse<CourseDto>> {
  const response = await fetch('/api/v1/courses');
  const body: ApiResponse<CourseDto[]> = await response.json();

  if (!body.success) {
    throw new Error(body.error?.message || 'Failed to fetch courses');
  }

  return {
    items: body.data || [],
    meta: body.meta!,
  };
}
```
