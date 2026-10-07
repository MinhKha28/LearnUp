# UC18 – Xem danh sách Quiz (Instructor): ghi chú thay đổi và luồng hoạt động

> Người làm: Trọng (thành viên D) · Nhánh: `feat/assessment/uc18-list-quizzes` · Ngày: 02/10/2026
> Trạng thái: **đã chạy được** (seed → API → build + dev màn hình), **chưa commit**. Các ca lỗi khác và giao diện: Trọng tự test theo [mục 7](#7-cách-chạy-và-kiểm-tra).
> Link trong file này là đường dẫn tương đối tính từ `docs_temp/`. `#Lxx` = dòng xx (đúng tại thời điểm viết, sửa code sau này có thể lệch vài dòng).
> Đi theo mẫu UC19 của C (Hào): [`assessments.controller.ts`](../services/assessment-service/src/assessments/assessments.controller.ts), [`assessments.service.ts`](../services/assessment-service/src/assessments/assessments.service.ts), [`course.builder.assignments.tsx`](../frontend/src/pages/instructor/course.builder.assignments.tsx). Luồng chung của assessment-service: [`docs/assessment/uc19-execution-flow.md`](../docs/assessment/uc19-execution-flow.md).

---

## Mục lục

1. [Tóm tắt nhanh](#1-tóm-tắt-nhanh)
2. [Luồng hoạt động (workflow)](#2-luồng-hoạt-động-workflow)
3. [Backend – assessment-service](#3-backend--assessment-service)
4. [Seed dữ liệu](#4-seed-dữ-liệu)
5. [Frontend](#5-frontend)
6. [Biến môi trường](#6-biến-môi-trường)
7. [Cách chạy và kiểm tra](#7-cách-chạy-và-kiểm-tra)
8. [Phần đang FAKE và cách chuyển sang thật](#8-phần-đang-fake-và-cách-chuyển-sang-thật)
9. [Lưu ý quan trọng / bẫy dễ dính](#9-lưu-ý-quan-trọng--bẫy-dễ-dính)
10. [Việc cần chuyển cho người khác](#10-việc-cần-chuyển-cho-người-khác)
11. [Gắn các UC sau vào đâu](#11-gắn-các-uc-sau-vào-đâu)

---

## 1. Tóm tắt nhanh

- **Nghiệp vụ:** Instructor xem các Quiz của **một Course mình đang phụ trách**, mỗi Quiz kèm số câu hỏi, điểm đạt tối thiểu, trạng thái bắt buộc, trạng thái khóa và **lý do khóa**.
- **Endpoint:** `GET /api/v1/assessments/quizzes?courseId=<uuid>[&moduleId=<uuid>]`. Chỉ role `INSTRUCTOR`. Đường dẫn nằm trong route `/api/v1/assessments/**` sẵn có của gateway.
- **Màn hình:** `/instructor/courses/:courseId/builder/quizzes`. Route đã có sẵn; trang được viết lại từ mockup sang API thật. Sidebar builder có thêm mục **Quizzes**.
- **Không migrate DB** (bảng `assessments`, `quiz_questions`, `quiz_attempts` đã đủ cột). Không sửa `.env`. Không cài thư viện. Không sửa code UC19 của C.
- **Không thêm fake mới:** dùng lại `CourseServiceClient` (`COURSE_CLIENT_MODE=http|fake`) của C.
- **Seed riêng:** `npm run db:seed:quizzes` (`prisma/seed-quizzes.ts`), có hàm tự kiểm ràng buộc trước khi ghi.

Quy tắc nghiệp vụ liên quan:

| BR | Nội dung | Áp dụng ở đâu |
|---|---|---|
| BR-79 | Instructor chỉ xem được nội dung Course mình đang phụ trách; Course của người khác không xuất hiện ở bất kỳ danh sách nào | `requireOwnCourse`: khác tổ chức hoặc không phải người phụ trách → **404** (giấu sự tồn tại) |
| BR-154 | Quiz gắn vào Module hoặc gắn vào Course | `moduleId` (null = gắn Course); lọc `moduleId` tùy chọn |
| BR-291 | Quiz gắn Module hiển thị sau toàn bộ Lesson của Module đó; Quiz gắn Course và Assignment ở cuối cây; thứ tự trong cùng chỗ gắn do Instructor sắp | Backend sắp: Quiz gắn Module trước, gắn Course sau, rồi `position`, rồi `id`. Frontend gom nhóm theo thứ tự Module của `structure` |
| BR-157 | Quiz giữ cờ bắt buộc (khác Assignment) vì Quiz có thể chỉ để tự kiểm tra giữa các Module, không nhất thiết tính vào điều kiện cấp Certificate | Trường `isRequired` → tag Required / Optional |
| BR-96 | Thêm, sửa, xóa câu hỏi và đáp án của Quiz chỉ làm được khi Quiz chưa có lượt làm bài | Lý do khóa `QUIZ_HAS_ATTEMPTS` |
| BR-97 | Sửa thời gian giới hạn, số lượt liên tiếp tối đa, thời gian tạm khóa của Quiz chỉ làm được khi Quiz chưa có lượt làm bài | Lý do khóa `QUIZ_HAS_ATTEMPTS` |
| BR-94 | Khi Course đã Locked, bị chặn sửa điểm đạt tối thiểu và trạng thái bắt buộc của Quiz | Lý do khóa `COURSE_LOCKED` |
| BR-285 | Khi Course ở Submitted, Instructor không chỉnh sửa được thành phần nào; muốn sửa phải thu hồi về Draft (BR-67) | Lý do khóa `COURSE_SUBMITTED` |
| BR-99 | Giao diện hiển thị lý do bị khóa của từng thành phần, để Instructor biết vì sao không sửa được | `lockReasons[]` + tooltip câu tiếng Anh |
| BR-323 | Course chỉ gửi phê duyệt được khi mọi Quiz có ít nhất một câu hỏi | Trang cảnh báo Quiz 0 câu hỏi; seed chỉ đặt Quiz rỗng ở Course Draft |
| BR-315 | Điểm thang 0–100, 2 chữ số thập phân; câu đúng khi tập đáp án chọn trùng tập đáp án đúng; điểm lượt = số câu đúng ÷ tổng câu × 100 | Seed tự tính `score` và kiểm `passing_score` |
| BR-159 | Điểm ghi nhận của Quiz là điểm của lượt cao nhất | Seed tính `recorded_attempt_id` (hòa thì lượt sớm hơn, theo thiết kế DB) |

`locked = lockReasons.length > 0`. `disabled` (`disabled_at` khác null, do course-service ra lệnh ở GĐ2) là **trường riêng**, không tính vào `lockReasons`.

---

## 2. Luồng hoạt động (workflow)

### 2.1 Tổng thể một request

```mermaid
sequenceDiagram
    autonumber
    actor I as Instructor (trình duyệt)
    participant L as layout.instructor.course.tsx
    participant P as course.builder.quizzes.tsx
    participant AX as assessment.service.ts<br/>(header dev gắn cứng)
    participant IG as InternalAuthGuard<br/>(toàn cục, có sẵn)
    participant VP as ValidationPipe<br/>(ListQuizzesQueryDto)
    participant C as QuizController
    participant S as QuizService
    participant CC as CourseServiceClient<br/>(http | fake)
    participant CS as course-service
    participant DB as assessment_db (Prisma)

    I->>L: mở /instructor/courses/:courseId/builder/quizzes
    L->>CS: GET /api/v1/courses/:courseId/structure (VITE_BACKEND_URL)
    CS-->>L: structure (course, modules có tiêu đề)
    L->>P: Outlet context { structure, assignments }
    P->>AX: fetchQuizzesAPI(courseId)
    AX->>IG: GET /api/v1/assessments/quizzes?courseId=… (+ 4 header dev)
    IG->>VP: CurrentUser hợp lệ
    VP->>C: courseId UUID, moduleId UUID tùy chọn
    C->>S: listQuizzes(user, query)
    S->>S: requireInstructor (role INSTRUCTOR?)
    S->>CC: getAuthoringContext(courseId, user)
    alt COURSE_CLIENT_MODE=http (mặc định)
        CC->>CS: GET /api/v1/courses/:id/authoring-context
        CS-->>CC: { organizationId, instructorId, status, locked, disabled }
    else COURSE_CLIENT_MODE=fake
        CC-->>S: Course "của người gọi", FAKE_COURSE_STATUS / FAKE_COURSE_LOCKED
    end
    S->>S: requireOwnCourse (cùng org + đúng người phụ trách?)
    S->>DB: findMany(org, courseId, kind QUIZ[, moduleId]) + _count questions, quizAttempts (1 truy vấn)
    S->>S: tính lockReasons từng Quiz
    S-->>C: QuizListPage { meta, items, courseLocked, courseStatus }
    C-->>AX: TransformInterceptor bọc { statusCode, message, data }
    AX-->>P: res.data (lỗi HTTP cũng resolve → kiểm res.data)
    P->>I: nhóm theo Module → Course-level → "Other Quizzes"
```

### 2.2 Các điểm chặn và mã lỗi

| Điểm chặn | Khi nào | HTTP | Body (rút gọn) |
|---|---|---|---|
| InternalAuthGuard | thiếu / sai `x-internal-key` | 401 | `Invalid or missing internal service key.` |
| InternalAuthGuard | thiếu `x-user-id` / `x-organization-id` / role không hợp lệ | 401 | `Missing authenticated user context.` |
| ValidationPipe | `courseId` thiếu / không phải UUID, `moduleId` không phải UUID, tham số lạ | 400 | `["courseId must be a UUID"]`, `["property foo should not exist"]` |
| `requireInstructor` | role khác `INSTRUCTOR` hoặc không có tổ chức | 403 | `{ code: "FORBIDDEN", message: "Only an Instructor can manage Quizzes." }` |
| `HttpCourseServiceClient` | course-service trả 404 (Course không có / khác tổ chức) | 404 | `{ code: "COURSE_NOT_FOUND", message: "Course not found." }` |
| `requireOwnCourse` | Course cùng tổ chức nhưng không phải người phụ trách | 404 | `Course not found.` |
| `HttpCourseServiceClient` | không gọi được course-service / HTTP khác | 503 | `{ code: "COURSE_SERVICE_UNAVAILABLE" }` |

### 2.3 Cách tính `lockReasons` (tính lúc đọc, không lưu)

| Lý do | Điều kiện | BR |
|---|---|---|
| `QUIZ_HAS_ATTEMPTS` | `_count.quizAttempts > 0` (trường `hasAttempts`) | BR-96, BR-97 |
| `COURSE_LOCKED` | authoring context `locked = true` | BR-94 |
| `COURSE_SUBMITTED` | `status.toUpperCase() === 'SUBMITTED'` | BR-285 |

So **không phân biệt hoa thường** (Trọng đã chốt): code course-service ghi/so `'SUBMITTED'` (HOA), còn seed `0199a…` và bản fake dùng `'Submitted'`. Cách này giống UC19 so `AUTHORABLE_STATUSES`.

---

## 3. Backend – assessment-service

Đường dẫn gốc: `services/assessment-service/`.

### 3.1 File mới

| File | Nội dung |
|---|---|
| [`src/modules/quiz/interfaces/quiz-list.interface.ts`](../services/assessment-service/src/modules/quiz/interfaces/quiz-list.interface.ts) | `QUIZ_KIND = 'QUIZ'` ([#L7](../services/assessment-service/src/modules/quiz/interfaces/quiz-list.interface.ts#L7)) dùng chung service + seed; `QuizLockReason`, `QuizSummary`, `QuizListPage` |
| [`src/modules/quiz/dto/list-quizzes-query.dto.ts`](../services/assessment-service/src/modules/quiz/dto/list-quizzes-query.dto.ts) | `courseId` `@IsUUID()` bắt buộc, `moduleId` `@IsOptional() @IsUUID()` |
| [`prisma/seed-quizzes.ts`](../services/assessment-service/prisma/seed-quizzes.ts) | Seed Quiz demo, xem [mục 4](#4-seed-dữ-liệu) |

### 3.2 File sửa

| File | Trước | Sau |
|---|---|---|
| [`src/modules/quiz/quiz.controller.ts`](../services/assessment-service/src/modules/quiz/quiz.controller.ts) | Khung rỗng `@Controller('quiz')` | `@ApiTags('UC18 - Quizzes')`, `@ApiSecurity('internal-key')`, `@Controller('assessments')` + `@Get('quizzes')`, `@ResponseMessage('Quizzes retrieved successfully.')` |
| [`src/modules/quiz/quiz.service.ts`](../services/assessment-service/src/modules/quiz/quiz.service.ts) | `QuizService {}` rỗng | `listQuizzes` ([#L28](../services/assessment-service/src/modules/quiz/quiz.service.ts#L28)); `requireInstructor` ([#L97](../services/assessment-service/src/modules/quiz/quiz.service.ts#L97)), `requireOwnCourse` ([#L109](../services/assessment-service/src/modules/quiz/quiz.service.ts#L109)) **chép từ AssessmentsService**, có comment "Trùng với AssessmentsService, nên tách dùng chung sau" |
| `src/modules/quiz/quiz.module.ts` | – | **Không cần sửa** (đã khai controller + provider) |
| [`src/app.module.ts`](../services/assessment-service/src/app.module.ts) | không nạp QuizModule | thêm `import { QuizModule } …` + `QuizModule,` trong `imports` (2 dòng: một import, một khai báo) |
| [`package.json`](../services/assessment-service/package.json) | – | thêm script `"db:seed:quizzes": "ts-node -P tsconfig.seed.json prisma/seed-quizzes.ts"` |

### 3.3 Chi tiết truy vấn

- `where`: `organizationId` **của người gọi** + `courseId` + `kind: QUIZ_KIND` (+ `moduleId` nếu có). `moduleId` chỉ lọc trong DB, không hỏi course-service Module có thuộc Course không.
- `orderBy` ([#L44](../services/assessment-service/src/modules/quiz/quiz.service.ts#L44)): `moduleId asc NULLS LAST`, `position asc`, `id asc`. Backend không biết thứ tự Module (course-service sở hữu), nên thứ tự giữa các Module do frontend sắp theo `structure.modules`.
- `include: { _count: { select: { questions: true, quizAttempts: true } } }`: đếm trong **cùng một truy vấn** (Prisma sinh subquery đếm), không N+1.
- Response giống UC19: `createPageResponse(items, 1, n, n)` ([#L89](../services/assessment-service/src/modules/quiz/quiz.service.ts#L89)) + `courseLocked`, `courseStatus`. Danh sách rỗng ra `meta.pages = 0` (giống UC19).
- `passingScore` đổi Decimal → `number`.

Ví dụ một item:

```json
{
  "id": "0199a000-0000-7000-8000-3a0000000005",
  "courseId": "33333333-bbbb-7333-8333-000000000002",
  "moduleId": "33333333-cccc-7333-8333-000000000003",
  "title": "Security fundamentals quiz",
  "position": 1,
  "questionCount": 3,
  "passingScore": 60,
  "isRequired": true,
  "timeLimitMinutes": 15,
  "maxConsecutiveAttempts": 3,
  "lockoutHours": 24,
  "hasAttempts": true,
  "locked": true,
  "lockReasons": ["QUIZ_HAS_ATTEMPTS"],
  "disabled": false
}
```

---

## 4. Seed dữ liệu

File [`prisma/seed-quizzes.ts`](../services/assessment-service/prisma/seed-quizzes.ts), chạy `npm run db:seed:quizzes`. **Không sửa** `prisma/seed.ts` của C.

- Upsert theo UUID cố định; chạy lại nhiều lần không trùng; không xóa / truncate; từ chối khi `NODE_ENV=production` ([#L900](../services/assessment-service/prisma/seed-quizzes.ts#L900)).
- `validate()` ([#L522](../services/assessment-service/prisma/seed-quizzes.ts#L522)) kiểm **trước khi ghi**; sai một luật → in danh sách lỗi, exit code 1, **không ghi dòng nào**. Toàn bộ phần ghi nằm trong một `$transaction`.
- In bảng số dòng theo từng bảng + danh sách Quiz sau khi ghi.

### 4.1 Luật tự kiểm (DB chưa có CHECK)

`passing_score` > 0 và ≤ 100, tối đa 2 chữ số thập phân · `time_limit_minutes` 1–1440 · n, m > 0 · title 1–200 ký tự · Module phải thuộc Course · mỗi Quiz ≤ 100 câu · Quiz 0 câu **chỉ ở Course Draft** (BR-323) · `position` không trùng trong cùng chỗ gắn (cả với Quiz/Assignment **khác đã có trong DB**) · câu hỏi ≤ 2000 ký tự, 2–10 đáp án, đáp án ≤ 500 ký tự · SingleChoice đúng 1 đáp án đúng · MultipleChoice ≥ 1 đáp án đúng · TrueFalse đúng 2 đáp án, 1 đúng · lượt làm: số lượt liên tiếp ≤ n, `submitted_at` ∈ (started, deadline], TimedOut nộp đúng lúc hết giờ, không bắt đầu khi lượt trước chưa nộp, đáp án chọn phải tồn tại và không trùng · mọi ID không trùng.

Khi ghi: Quiz luôn `prompt`/tệp đề bài/`expected_duration_minutes` = null, `peer_review_enabled = false`, các tham số chấm chéo = null. `deadline_at = started_at + time_limit`, `score = số câu đúng ÷ tổng câu × 100` (tính từ đáp án đã chọn), `learner_assessment_states` tính từ các lượt: `consecutive_count` = số lượt, `locked_until` chỉ đặt khi đủ n lượt, `recorded_attempt_id` = lượt điểm cao nhất (hòa → lượt sớm hơn).

Giá trị `question_type` / `submission_kind`: **chưa có code nào dùng**, nên theo tài liệu: `SingleChoice`, `MultipleChoice`, `TrueFalse`; `Manual`, `TimedOut` (PascalCase, khác `kind = 'QUIZ'` viết HOA – xem [mục 9](#9-lưu-ý-quan-trọng--bẫy-dễ-dính)).

### 4.2 Quy ước ID

`0199a000-0000-7000-8000-` + nhóm + số: **3a** = Quiz, **3b** = câu hỏi, **3c** = đáp án, **3d** = lượt làm, **3e** = learner_assessment_states, **3f** = đáp án đã chọn (`quiz_attempt_answers`; nhóm này thêm vì bảng cần ID cố định để upsert).

Ví dụ: Quiz 5 = `…3a0000000005`, câu 2 của Quiz 5 = `…3b0000000502`, đáp án 3 của câu đó = `…3c0000050203`, lượt 1 = `…3d0000000501`.

### 4.3 Bảng ID để test

ID tổ chức / Course / Module lấy đúng từ `services/course-service/prisma/seed.ts`.

| Quiz ID (`…3a…`) | Course | Chỗ gắn | pos | Bắt buộc | Câu | Lượt làm | Kỳ vọng `lockReasons` (Course chưa Locked) |
|---|---|---|---|---|---|---|---|
| `…3a0000000001` Safety basics check | UI Draft `33333333-bbbb-7333-8333-000000000001` | Module `…cccc-…0001` Safety basics | 1 | ✔ | 3 | 0 | `[]` |
| `…3a0000000002` Hazard spotting practice | UI Draft | Module `…cccc-…0001` | 2 | ✘ | 2 | 0 | `[]` |
| `…3a0000000003` Emergency procedures quiz | UI Draft | Module `…cccc-…0002` Emergency procedures | 1 | ✔ | 2 | 0 | `[]` |
| `…3a0000000004` Final safety quiz | UI Draft | Course | 101 | ✔ | **0** | 0 | `[]` (cảnh báo BR-323) |
| `…3a0000000005` Security fundamentals quiz | UI Published `33333333-bbbb-7333-8333-000000000002` | Module `…cccc-…0003` Security fundamentals | 1 | ✔ | 3 | 2 (33.33 Manual, 66.67 TimedOut) | `["QUIZ_HAS_ATTEMPTS"]` |
| `…3a0000000006` Practice: spot the phishing email | UI Published | Course | 101 | ✘ | 2 | 0 | `[]` |
| `…3a0000000007` Kiểm tra: Nhận diện mối nguy | org A `…0e0000000002` An toàn lao động v2 (Published) | Module `…1a0000000011` | 1 | ✔ | 2 | 1 (100) | `["QUIZ_HAS_ATTEMPTS"]` |
| `…3a0000000008` Ôn tập cuối khóa | org A `…0e0000000002` | Course | 101 | ✘ | 2 | 0 | `[]` |
| `…3a0000000009` Kiểm tra: Giới thiệu sản phẩm | **org B** `…0e0000000006` Nhập môn sản phẩm | Module `…1a0000000041` | 1 | ✔ | 1 | 0 | dùng để thử không xem chéo |

Danh tính để gọi:

| Danh tính | x-user-id | x-organization-id | Thấy Course |
|---|---|---|---|
| Instructor UI (frontend gắn cứng) | `33333333-3333-7333-8333-333333333333` | `22222222-2222-7222-8222-222222222222` | UI Draft, UI Published |
| Instructor org A | `0199a000-0000-7000-8000-0c0000000001` | `0199a000-0000-7000-8000-0a0000000001` | `…0e0000000002` |
| Instructor org B | `0199a000-0000-7000-8000-0c0000000002` | `0199a000-0000-7000-8000-0a0000000002` | `…0e0000000006` |

Learner của các lượt làm: org A dùng `LEARNER_1 = 0199a000-0000-7000-8000-0b0000000001` (có trong seed course). Org UI **không có Learner nào** trong seed course, nên dùng ID logic tự đặt `33333333-eeee-7333-8333-000000000001` ([#L33](../services/assessment-service/prisma/seed-quizzes.ts#L33), Trọng đã đồng ý); tenant không có user này.

Số dòng sau khi seed (2 lần chạy giống hệt): assessments 9 · quiz_questions 17 · quiz_question_options 43 · quiz_attempts 3 · quiz_attempt_answers 9 · learner_assessment_states 2.

**Điểm lệch đã biết:** Course Published trong seed course-service (`…0e0000000002`, UI Published) có `lockedAt = null` dù Quiz đã có lượt làm. Thực tế có lượt làm nghĩa là đã có Enrollment, nên Course phải Locked (BR-80). Không sửa seed course-service; muốn thấy `COURSE_LOCKED` thì dùng `FAKE_COURSE_LOCKED=true` ([mục 6](#6-biến-môi-trường)).

Quiz gắn Course dùng `position = 101` để không đụng `position` của Assignment ở cùng chỗ gắn (Assignment do seed UC19 hoặc tạo trên UI bắt đầu từ 1). `validate()` vẫn kiểm trùng với DB.

---

## 5. Frontend

Đường dẫn gốc: `frontend/src/`. Đã đọc `frontend/AGENTS.md` và `.agents/skills/*`: UI tiếng Anh, `.scss` thường, class kebab-case có tiền tố, không thêm màu (chỉ dùng biến `--color-*` trong `global.scss`), Ant Design 5.21.6.

| File | Thay đổi |
|---|---|
| [`types/assessment.types.ts`](../frontend/src/types/assessment.types.ts) | **Chỉ thêm** `QuizLockReason` ([#L112](../frontend/src/types/assessment.types.ts#L112)), `IQuizSummary`, `IQuizList` |
| [`services/assessment.service.ts`](../frontend/src/services/assessment.service.ts) | **Chỉ thêm** `fetchQuizzesAPI(courseId, moduleId?)` ([#L93](../frontend/src/services/assessment.service.ts#L93)), cùng `requestConfig` (header dev, `VITE_ASSESSMENT_BACKEND_URL`) và `toApiCourseId` như UC19 |
| [`pages/instructor/course.builder.quizzes.tsx`](../frontend/src/pages/instructor/course.builder.quizzes.tsx) | Viết lại: bỏ `findInstructorCourse` / `findCourseStructure` / `quizLocationLabel` (mock), lấy `structure` từ Outlet context, gọi API thật. Giữ bố cục mockup (crumb, hero, `builder-grid`, `builder-table`, nút Create Quiz, `InfoPanel`) |
| [`pages/instructor/course.builder.quizzes.scss`](../frontend/src/pages/instructor/course.builder.quizzes.scss) | Mới: lưới 5 cột, dòng tiêu đề nhóm, cảnh báo, trạng thái disabled của link |
| [`components/instructor/course.nav.tsx`](../frontend/src/components/instructor/course.nav.tsx) | **Thêm đúng một mục** "Quizzes" (class `builder-nav-lesson`, active theo URL) ngay dưới tiêu đề "Course Assessments", trên danh sách Assignment |

Trang Quizzes:

- **Gom nhóm** ([#L78](../frontend/src/pages/instructor/course.builder.quizzes.tsx#L78)): mỗi Module theo thứ tự `structure.modules` ("Module 1: Safety basics"), sau đó "Course-level Quizzes", cuối cùng "Other Quizzes" cho Quiz có `moduleId` không có trong structure.
- **Mỗi Quiz:** title, thời gian giới hạn, số câu hỏi, passing score (`70%`), `StatusTag` Required (info) / Optional (neutral), Locked (warning, icon khóa, **tooltip liệt kê lý do bằng câu tiếng Anh**, [#L14](../frontend/src/pages/instructor/course.builder.quizzes.tsx#L14)) hoặc Unlocked (success), tag Disabled (error) nếu `disabled`. Quiz 0 câu hỏi: dòng cảnh báo đỏ + banner tổng ở đầu thẻ.
- **Banner cấp Course:** "Course Submitted" / "Course Locked" khi API báo.
- **Trạng thái:** loading ("Loading Quizzes..."), empty ("No Quizzes yet."), error (banner đỏ + nút **Try again** gọi lại API). Axios của project không reject lỗi HTTP, nên kiểm `res.data` và lấy thông báo bằng `assessmentErrorText`.
- **Chưa có trang con thật:** "+ Create Quiz", "View details", "Manage questions" đều **disabled + tooltip "Coming soon"**. Dòng Quiz không bấm được.

Không sửa: `router.tsx`, layout, `instructor.ui.*`, `axios.customize.ts`, `course.builder.tsx`.

---

## 6. Biến môi trường

**UC18 không thêm biến mới.**

### 6.1 Backend – `services/assessment-service/.env`

| Biến | Bắt buộc | Giá trị dev | Ghi chú |
|---|---|---|---|
| `PORT` | – | `8086` | |
| `DATABASE_URL` | ✔ | `postgresql://postgres:postgres@localhost:5432/assessment_db?schema=public` | dùng cho cả service lẫn seed |
| `INTERNAL_SERVICE_KEY` | ✔ | `learnup-internal-secret` | phải trùng header `x-internal-key` và key của course-service |
| `COURSE_CLIENT_MODE` | – | `http` (mặc định) / `fake` | xem dưới |
| `COURSE_SERVICE_URL` | – | `http://localhost:8083` | chỉ dùng ở `http` |
| `COURSE_SERVICE_TIMEOUT_MS` | – | `5000` | |
| `FAKE_COURSE_STATUS` | – | `Draft` (mặc định) | chỉ dùng ở `fake` |
| `FAKE_COURSE_LOCKED` | – | `false` | chỉ dùng ở `fake` |

**Khi nào dùng `http` / `fake`:**

- `http` (mặc định, đúng nghiệp vụ): cần course-service chạy ở 8083 và đã `npm run db:seed` bên course-service. Kiểm được BR-79 (404 khi Course khác tổ chức / không phải của mình).
- `fake`: khi không chạy được course-service. **Mọi Course đều coi là của người gọi**, nên **không thử được 404**. Nhưng vì truy vấn vẫn lọc `organizationId` của người gọi, Course tổ chức khác chỉ ra danh sách rỗng, không lộ dữ liệu.

**Thử từng lý do khóa** (đặt biến trong shell, không cần sửa `.env`):

```bash
cd services/assessment-service
# QUIZ_HAS_ATTEMPTS: có sẵn trong seed (Quiz …3a…05, …3a…07), không cần biến gì
COURSE_CLIENT_MODE=fake npm run start:dev
# COURSE_LOCKED (BR-94)
COURSE_CLIENT_MODE=fake FAKE_COURSE_LOCKED=true npm run start:dev
# COURSE_SUBMITTED (BR-285)
COURSE_CLIENT_MODE=fake FAKE_COURSE_STATUS=Submitted npm run start:dev
# cả hai
COURSE_CLIENT_MODE=fake FAKE_COURSE_LOCKED=true FAKE_COURSE_STATUS=Submitted npm run start:dev
```

(PowerShell: `$env:COURSE_CLIENT_MODE='fake'; $env:FAKE_COURSE_LOCKED='true'; npm run start:dev`, nhớ `Remove-Item Env:FAKE_COURSE_LOCKED` sau khi thử.)

### 6.2 Frontend – `frontend/.env.development.local` (không commit)

| Biến | Giá trị cho UC18 | Vì sao |
|---|---|---|
| `VITE_BACKEND_URL` | `http://localhost:8083` | **Bắt buộc trỏ course-service**: layout builder gọi `/api/v1/courses/:id/structure` qua biến này. Để 8084 (tenant) thì trang báo "Unable to load Course structure." |
| `VITE_ASSESSMENT_BACKEND_URL` | `http://localhost:8086` | Các hàm UC18/UC19 gọi thẳng assessment-service. Để trống thì gọi theo `VITE_BACKEND_URL` (sai service) |
| `VITE_DEV_USER_ID` | trống = `33333333-3333-7333-8333-333333333333` | đổi danh tính khi gọi **assessment** |
| `VITE_DEV_ORGANIZATION_ID` | trống = `22222222-2222-7222-8222-222222222222` | |
| `VITE_DEV_USER_ROLE` | trống = `INSTRUCTOR` | đặt `ORGANIZER` để thấy lỗi 403 trên giao diện |
| `VITE_DEV_INTERNAL_KEY` | trống = `learnup-internal-secret` | |

Ví dụ:

```env
VITE_BACKEND_URL=http://localhost:8083
VITE_ASSESSMENT_BACKEND_URL=http://localhost:8086
```

⚠ `course.service.ts` (của B) **gắn cứng** header 3333/2222, không đọc `VITE_DEV_*`. Vì vậy builder chỉ mở được 2 Course bộ UI. Đổi `VITE_DEV_USER_ID` sang Instructor org A thì structure vẫn là Course UI còn assessment trả 404, nên trên giao diện chỉ thử được bộ UI.

⚠ **Quay lại UC12 / UC13** (tenant-service) thì phải trỏ `VITE_BACKEND_URL` về `http://localhost:8084` và khởi động lại `npm run dev` (Vite chỉ đọc `.env` lúc khởi động).

Mẹo: muốn thử mà không sửa file thì truyền biến qua shell, vì Vite ưu tiên biến shell hơn file `.env`:
`VITE_BACKEND_URL=http://localhost:8083 VITE_ASSESSMENT_BACKEND_URL=http://localhost:8086 npx vite`.

---

## 7. Cách chạy và kiểm tra

### 7.1 Chạy

```bash
# 1. course-service (cần npm install trước; máy Trọng hiện CHƯA có node_modules ở course-service)
cd services/course-service && npm run db:seed && npm run start:dev
# 2. assessment-service
cd services/assessment-service
npm run db:seed          # Assignment của C (tùy chọn)
npm run db:seed:quizzes  # Quiz UC18
npm run start:dev        # hoặc COURSE_CLIENT_MODE=fake npm run start:dev nếu không có course-service
# 3. frontend (sau khi chỉnh .env.development.local theo mục 6.2)
cd frontend && npm run dev
# mở http://localhost:3000/instructor/courses/33333333-bbbb-7333-8333-000000000001/builder/quizzes
```

### 7.2 Curl mẫu

```bash
B=http://localhost:8086/api/v1/assessments/quizzes
H=(-H "x-internal-key: learnup-internal-secret" -H "x-user-id: 33333333-3333-7333-8333-333333333333" -H "x-organization-id: 22222222-2222-7222-8222-222222222222")
curl "$B?courseId=33333333-bbbb-7333-8333-000000000001" "${H[@]}" -H "x-user-role: INSTRUCTOR"   # 200, 4 Quiz
curl "$B?courseId=33333333-bbbb-7333-8333-000000000001" "${H[@]}" -H "x-user-role: ORGANIZER"    # 403
curl "$B?courseId=0199a000-0000-7000-8000-0e0000000006" "${H[@]}" -H "x-user-role: INSTRUCTOR"   # 404 (http mode)
curl "$B?courseId=33333333-bbbb-7333-8333-000000000002&moduleId=33333333-cccc-7333-8333-000000000003" "${H[@]}" -H "x-user-role: INSTRUCTOR"  # lọc Module
```

### 7.3 Kết quả đã kiểm (02/10/2026)

| Lệnh / ca | Kết quả |
|---|---|
| `npx prisma validate` (tự nạp `prisma7.config.ts`, cả khi có lẫn không có `--config`) | ✅ schema valid |
| `npx tsc --noEmit` (gồm cả `prisma/seed-quizzes.ts`) | ✅ 0 lỗi |
| `npm run build` | ✅ |
| `npx eslint` 7 file backend của UC18 (không `--fix`) | ✅ (lúc đầu báo lỗi định dạng ở 2 file mới, đã sửa bằng `prettier --write` **chỉ cho 2 file đó**) |
| `npx prettier --check` 7 file backend | ✅ |
| `npm run db:seed:quizzes` × 2 | ✅ cùng kết quả (chỉ khác PID trong cảnh báo `DEP0180` của Node); đọc lại DB: điểm, deadline, recorded attempt đúng |
| `npm run start:dev` | ✅ log `Mapped {/api/assessments/quizzes, GET} (version: 1)` |
| Fake: UI Draft, INSTRUCTOR | ✅ 200, 4 Quiz, đúng thứ tự Module 1 (pos 1, 2) → Module 2 → Course |
| Fake: role ORGANIZER | ✅ 403 `FORBIDDEN` |
| Fake: UI Published + `moduleId` | ✅ 200, 1 Quiz, `["QUIZ_HAS_ATTEMPTS"]` |
| Fake: Course org B với danh tính UI | ✅ 200 **rỗng** (fake không trả 404, nhưng không lộ dữ liệu) |
| `courseId=abc&foo=1` | ✅ 400 |
| Thiếu `x-internal-key` | ✅ 401 |
| Fake `FAKE_COURSE_LOCKED=true FAKE_COURSE_STATUS=Submitted` | ✅ `[QUIZ_HAS_ATTEMPTS, COURSE_LOCKED, COURSE_SUBMITTED]` và `[COURSE_LOCKED, COURSE_SUBMITTED]` |
| HTTP + **stub course-service**: Course org B | ✅ 404 `COURSE_NOT_FOUND` |
| HTTP + stub: cùng org, Instructor khác | ✅ 404 `Course not found.` |
| HTTP + stub: status `PUBLISHED` (HOA) | ✅ 200 |
| Frontend `npx eslint` 4 file | ✅ |
| Frontend `npm run build` | ✅ (chỉ cảnh báo chunk > 500 kB có sẵn từ trước) |
| `npm run dev` + mở trang Quizzes (Chrome, đọc DOM) | ✅ Draft: 3 nhóm, banner 0 câu hỏi; Published: Locked + mục "Quizzes" active ở sidebar; tắt assessment-service → banner lỗi + Try again |

**Stub course-service:** course-service trên máy chưa có `node_modules` (`'nest' is not recognized`) và UC18 không được cài package. Vì vậy ca 404 ở chế độ http và màn hình được thử bằng một **stub Node tạm đặt ngoài repo** (thư mục scratchpad của Claude, không commit). Stub trả `authoring-context` và `structure` của 2 Course UI cùng Course org B theo đúng dữ liệu seed course-service, và lọc theo `x-organization-id` như `courses.service.ts`. **Chưa thử với course-service thật.**

**Chưa kiểm:** chụp màn hình (screenshot Chrome bị timeout, chỉ đọc được DOM), giao diện / responsive, các ca lỗi khác: Trọng tự kiểm.

---

## 8. Phần đang FAKE và cách chuyển sang thật

| Đang fake | Ở đâu | Chuyển sang thật |
|---|---|---|
| Danh tính người gọi | header gắn cứng trong `frontend/src/services/assessment.service.ts` (của C) + `course.service.ts` (của B) | Khi gateway đăng ký Eureka cho các service Nest và gắn header (đã có trong `JwtAuthenticationFilter`): bỏ `devHeaders`, `VITE_ASSESSMENT_BACKEND_URL`, gọi qua gateway `/api/v1/assessments/quizzes`. Code backend không đổi |
| Course owner / status / Locked (tùy chọn) | `COURSE_CLIENT_MODE=fake` | Đặt `http` (mặc định) + chạy course-service. Không đổi code |
| Learner org UI `33333333-eeee-…0001` | `seed-quizzes.ts` | Khi có Learner thật cho org UI trong tenant/course seed thì thay ID |

UC18 **không tạo fake mới**.

---

## 9. Lưu ý quan trọng / bẫy dễ dính

1. **`kind = 'QUIZ'`**: tài liệu ghi `'Quiz'`, code UC19 ghi `'ASSIGNMENT'`; tạm dùng `'QUIZ'` cho đồng bộ, khai **một chỗ** `QUIZ_KIND`. Nếu nhóm chốt PascalCase thì phải đổi hằng số + dữ liệu cũ (`UPDATE assessments SET kind = …`) + hằng số của C.
2. **Kiểu chữ lẫn lộn**: `kind` HOA, `question_type` / `submission_kind` PascalCase theo tài liệu, status Course HOA (code B) và PascalCase (seed 0199a, fake). Mọi so sánh status nên `toUpperCase()`.
3. **Hai controller cùng `@Controller('assessments')`** (AssessmentsController của C và QuizController): hợp lệ trong Nest, route không trùng (`assignments` vs `quizzes`). Đừng tạo `@Controller('quiz')`: gateway chỉ route `/api/v1/assessments/**`.
4. **`moduleId` không được xác nhận** thuộc Course: gửi Module của Course khác thì chỉ ra danh sách rỗng.
5. **Axios không reject lỗi HTTP**: luôn kiểm `res.data`; chỉ lỗi mạng mới vào `catch`.
6. **Mục "Quizzes" ở sidebar nằm trong khối Assignments**: khi không gọi được assessment-service (`assignments = null`) thì mục này ẩn. Vẫn vào bằng URL được.
7. **Builder chỉ mở được Course bộ UI** vì `course.service.ts` gắn cứng 3333/2222.
8. **`VITE_BACKEND_URL` dùng chung** cho course (UC18/UC19) và tenant (UC12/UC13): đổi qua lại phải khởi động lại Vite.
9. `nest build` ra `dist/src/main.js`, **không có `dist/main.js`** (vì tsconfig gồm cả `prisma/`), nên `npm run start:prod` (`node dist/main`) đang hỏng **từ trước UC18**. Chạy bản build: `node dist/src/main.js`.
10. `prisma7.config.ts` **được Prisma tự nhận** (đã thử `prisma validate`), lo ngại trong báo cáo khảo sát là không cần.
11. `package-lock.json` của assessment-service có thay đổi `"peer": true` **không thuộc UC18**: đừng commit lẫn.
12. Quiz gắn Course trong seed dùng `position 101` (xem mục 4). Khi làm UC18.2, Quiz mới gắn Course nên lấy `max(position) + 1` trên **cả Quiz lẫn Assignment** cùng chỗ gắn (BR-291), như UC19 đang làm.

---

## 10. Việc cần chuyển cho người khác

| Cho ai | Việc |
|---|---|
| **C (Hào)** | Thống nhất giá trị `kind` (`'QUIZ'`/`'ASSIGNMENT'` HOA hay `'Quiz'`/`'Assignment'` theo tài liệu). Tách `requireInstructor` / `requireOwnCourse` ra chỗ dùng chung (hiện chép ở `QuizService` #L97, #L109) và `KIND_ASSIGNMENT` / `QUIZ_KIND` ra một file hằng số. Báo: đã thêm `QuizModule` vào `app.module.ts` và script `db:seed:quizzes` vào `package.json` |
| **B / C** | Đã thêm **một mục "Quizzes"** vào `frontend/src/components/instructor/course.nav.tsx` (trong khối "Course Assessments"); nếu B/C sửa sidebar thì giữ mục này |
| **B** | Seed course-service: Course Published (`…0e0000000002`, `33333333-bbbb-…0002`) có `lockedAt = null` dù đã có lượt làm Quiz; nên Locked cho khớp BR-80. Khi làm UC20 (gửi phê duyệt, BR-323): đếm Quiz 0 câu hỏi dùng lại được truy vấn `_count.questions` của `QuizService.listQuizzes` (lọc `questionCount === 0`), cần một endpoint internal của assessment-service |
| **A / người phụ trách DB** | Các CHECK / FK / unique còn thiếu ở `assessment_db` (đã nêu trong báo cáo khảo sát): CHECK `passing_score` (0, 100], `time_limit_minutes` 1–1440, `kind`, `question_type`, `submission_kind`, `consecutive_count ≥ 0`, luật Quiz/Assignment; unique `position` theo chỗ gắn (BR-291); FK `quiz_attempt_answers.option_id` → `quiz_question_options`, FK `learner_assessment_states.recorded_attempt_id` / `latest_submission_id`; ràng buộc tối đa một lượt đang làm mỗi Learner mỗi Quiz |

---

## 11. Gắn các UC sau vào đâu

| UC | Backend | Frontend |
|---|---|---|
| **UC18.1 – Xem chi tiết Quiz** | `GET /api/v1/assessments/quizzes/:id` trong `QuizController`; `findFirst` theo `id` + `organizationId` + `kind: QUIZ_KIND`, include `questions` (+ `options`, `orderBy position`), rồi `requireOwnCourse(user, quiz.courseId)`. Dùng lại cách tính `lockReasons` (nên tách hàm riêng) | Trang mock `course.builder.quiz.detail.tsx` (route `quizzes/:quizId`); bật link "View details" và cho dòng bấm được |
| **UC18.2 – Tạo Quiz** | `POST /api/v1/assessments/quizzes`; theo `createAssignment`: kiểm Course authorable / không Submitted; Course Locked chỉ cho Quiz không bắt buộc, đặt cuối (BR-318); `pg_advisory_xact_lock` + `max(position) + 1` theo chỗ gắn (cả Quiz lẫn Assignment); n/m mặc định từ `platform_settings`; `time_limit` 1–1440 | `course.builder.quiz.create.tsx` (route `quizzes/new`); bật nút "+ Create Quiz" |
| **UC18.3 – Quản lý câu hỏi Quiz** | `POST/PATCH/DELETE …/quizzes/:id/questions[/:questionId]`; chặn khi `hasAttempts` (BR-96), không xóa câu cuối khi Course đã rời Draft/Rejected (BR-323), Submitted chặn mọi sửa (BR-285); luật đáp án như `validate()` của seed | `course.builder.quiz.question.edit.tsx`; bật link "Manage questions" |
| **UC18.4 – Cập nhật cấu hình Quiz** | `PATCH /api/v1/assessments/quizzes/:id`; `time_limit`, n, m chặn khi `hasAttempts` (BR-97); `passingScore`, `isRequired` chặn khi `courseLocked` (BR-94); Submitted chặn tất cả (BR-285). Lý do khóa trả về lấy chung từ `lockReasons` | `course.builder.quiz.configuration.edit.tsx` (route `quizzes/:quizId/edit`) |

Sau khi UC18.1–18.4 xong: bỏ tooltip "Coming soon" trên trang danh sách, gỡ dữ liệu Quiz mock trong `components/instructor/instructor.data.ts` (nếu không trang nào còn dùng).
