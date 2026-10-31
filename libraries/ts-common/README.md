# LearnUP Course Service

Course Service là microservice NestJS phụ trách nhóm chức năng liên quan đến Course và Curriculum trong hệ thống LearnUP.

> Hiện tại đây là base kỹ thuật để team tiếp tục phát triển feature. Một số code Course/Curriculum và Prisma model hiện chỉ mang tính scaffold/demo, chưa phải nghiệp vụ hoàn chỉnh.

## 1. Tech Stack

- Node.js 22+
- NestJS 11
- TypeScript
- Prisma 7
- PostgreSQL
- `@prisma/adapter-pg`
- `class-validator`
- Swagger
- Jest
- Shared package: `@learnup/ts-common`

## 2. Cấu trúc chính

```text
services/course-service/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── src/
│   ├── common/
│   │   ├── decorator/
│   │   ├── filters/
│   │   ├── guards/
│   │   └── interceptors/
│   ├── courses/
│   ├── curriculum/
│   ├── prisma/
│   ├── app.module.ts
│   └── main.ts
├── .env.example
├── package.json
└── README.md
```

## 3. Setup lần đầu

### Bước 1: Build `ts-common`

Từ root repository:

```bash
cd libraries/ts-common
npm install
npm run build
```

### Bước 2: Cài dependencies cho Course Service

```bash
cd ../../services/course-service
npm install
```

### Bước 3: Tạo file `.env`

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Mẫu cấu hình:

```env
PORT=8083
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/course_db"
INTERNAL_SERVICE_KEY=<private random key, at least 32 bytes>
```

> Không commit file `.env`.

### Bước 4: Chuẩn bị database

Đảm bảo PostgreSQL đang chạy và database `course_db` đã tồn tại.

Validate Prisma schema:

```bash
npx prisma validate
```

Generate Prisma Client:

```bash
npm run prisma:generate
```

Nếu cần chạy migration development:

```bash
npm run prisma:migrate
```

### Bước 5: Chạy service

```bash
npm run start:dev
```

Service mặc định:

```text
http://localhost:8083
```

API prefix:

```text
/api/v1
```

Swagger:

```text
http://localhost:8083/docs
```

## 4. Internal Authentication

Course Service không tự verify JWT từ client.

Luồng hiện tại:

```text
Client
  ↓
API Gateway
  ↓ verify JWT
  ↓ truyền trusted headers
Course Service
```

Protected endpoint cần các header:

```text
x-internal-key
x-user-id
x-organization-id
x-user-role
```

Ví dụ:

```http
x-internal-key: <INTERNAL_SERVICE_KEY>
x-user-id: user-001
x-organization-id: org-001
x-user-role: INSTRUCTOR
```

Các role dùng chung được định nghĩa trong `@learnup/ts-common`:

```text
ADMIN
ORGANIZER
INSTRUCTOR
LEARNER
```

Endpoint public có thể dùng:

```ts
@Public()
```

## 5. Shared Library `@learnup/ts-common`

Course Service đang dùng:

```json
"@learnup/ts-common": "file:../../libraries/ts-common"
```

`ts-common` dùng cho các contract kỹ thuật dùng chung như:

- `UserRole`
- `CurrentUser`
- `HEADER_NAMES`
- `ApiResponse`
- `PageResponse`
- Error codes
- Event envelope

Không đưa business logic hoặc code phụ thuộc NestJS vào `ts-common`.

Giữ trong Course Service:

- Guard
- Interceptor
- Exception Filter
- NestJS Decorator
- DTO
- Prisma model
- Course/Curriculum business logic

## 6. Quy ước code

Luồng chuẩn:

```text
Controller
  ↓
Service
  ↓
Prisma
  ↓
PostgreSQL
```

Trách nhiệm:

```text
Controller  → route, DTO, request context
Service     → business logic
Prisma      → database access
DTO         → validate input
```

Không viết business logic trực tiếp trong controller.

Feature nên theo cấu trúc:

```text
feature/
├── dto/
├── feature.controller.ts
├── feature.service.ts
└── feature.module.ts
```

## 7. API Response

Response thành công được normalize bởi `TransformInterceptor` theo contract:

```ts
export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}
```

Ví dụ:

```json
{
  "statusCode": 200,
  "message": "Courses fetched successfully",
  "data": []
}
```

Dùng:

```ts
@ResponseMessage('Courses fetched successfully')
```

để khai báo message cho endpoint.

## 8. Validation

Global `ValidationPipe` đang bật:

```ts
whitelist: true;
transform: true;
forbidNonWhitelisted: true;
```

DTO phải khai báo validation bằng `class-validator`.

Ví dụ:

```ts
export class CreateCourseDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

## 9. Prisma

Inject Prisma bằng:

```ts
constructor(
  private readonly prisma: PrismaService,
) {}
```

Khi thay đổi Prisma schema:

```bash
npx prisma validate
npx prisma migrate dev --name <migration_name>
npx prisma generate
```

Không sửa migration cũ đã được dùng chung nếu chưa thống nhất với team.

## 10. Lưu ý cho team

- `courses` và `curriculum` hiện có thể chứa code demo/scaffold.
- Không xem Prisma `Course` model hiện tại là schema nghiệp vụ cuối cùng.
- Business fields, relations, status và rules sẽ bổ sung theo Use Case/Business Rule khi implement feature thật.
- Không duplicate role, header hoặc API response type nếu `ts-common` đã có.
- Không đưa business logic vào `ts-common`.
- Không commit `.env`.
- Hạn chế sửa file/module không liên quan đến feature đang làm.
- Nếu nhiều người cùng sửa Prisma schema, cần thống nhất trước để tránh migration conflict.

## 11. Trước khi tạo Pull Request

Chạy:

```bash
npm run build
npm run lint
npm run test
npx prisma validate
```

Nếu có thay đổi Prisma:

```bash
npx prisma generate
```

Nếu thay đổi database:

```bash
npx prisma migrate dev --name <meaningful_migration_name>
```

## 12. Git Convention

Branch gợi ý:

```text
feature/course-create
feature/curriculum-module
fix/course-validation
refactor/course-service-base
```

Commit gợi ý:

```text
feat(course): implement course creation
feat(curriculum): add module management
fix(auth): validate internal user context
refactor(common): reuse shared response contract
```

## 13. Checklist khi clone project

```text
[ ] Node.js 22+ đã cài
[ ] PostgreSQL đang chạy
[ ] ts-common đã npm install + build
[ ] course-service đã npm install
[ ] đã tạo .env
[ ] Prisma schema validate thành công
[ ] Prisma Client generate thành công
[ ] service chạy được bằng npm run start:dev
[ ] Swagger mở được tại /docs
[ ] protected API trả 401 khi thiếu internal headers
[ ] protected API hoạt động khi header hợp lệ
```
