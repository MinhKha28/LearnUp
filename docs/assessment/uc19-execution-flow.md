# Luồng thực thi UC19 → UC19.5 (từ lệnh terminal đến màn hình)

> Tài liệu học tập. Số dòng lấy theo code lúc viết, có thể lệch vài dòng khi code đổi.

## 0. Đọc trước: dự án này KHÔNG phải Next.js

| Phần | Công nghệ thật | Điểm khác Next.js |
| --- | --- | --- |
| Frontend (`frontend/`) | React 18 + **Vite** + **React Router** + Ant Design | Không có `app/`, `pages/` tự thành route, không có Server Component, không có SSR. Route khai báo tay trong `src/router.tsx`. Mọi thứ chạy trong trình duyệt. |
| Backend (`services/assessment-service`) | **NestJS** (Express) + Prisma + PostgreSQL | Backend là một server riêng, không nằm chung với frontend. Next.js "API route" ≈ Controller của Nest, nhưng ở đây tách hẳn thành tiến trình khác, cổng khác. |

Ánh xạ khái niệm cho người đang học Next.js:

| Next.js | Dự án này |
| --- | --- |
| `app/.../page.tsx` | file trong `src/pages/...`, gắn route ở `router.tsx` |
| `layout.tsx` | `LayoutInstructorCourse` (route cha, các trang con chui vào `<Outlet />`) |
| `useParams`, `useRouter().push` | `useParams`, `useNavigate()` của React Router |
| Route handler `route.ts` | `@Controller` + `@Get/@Post...` của NestJS |
| `fetch` / server action | `axios` gọi HTTP sang service khác |

Có 3 tiến trình chạy cùng lúc khi dùng UC19:

```
Trình duyệt (React, cổng 3000)
   │  axios (HTTP)
   ▼
assessment-service (NestJS, cổng 8086) ──HTTP──▶ course-service (NestJS, cổng 8083)
   │ Prisma                                          │ Prisma
   ▼                                                  ▼
assessment_db (Postgres)                         course_db (Postgres)
```

---

## 1. Giai đoạn A: chạy lệnh và khởi động Backend

### A1. Lệnh terminal

```
cd services/assessment-service
npm run start:dev
```

```
npm run start:dev
 -> đọc "scripts" trong package.json: "start:dev": "nest start --watch"
 -> nest start --watch
 -> biên dịch TypeScript (src/*.ts) thành JavaScript trong dist/
 -> node dist/main.js           (tự chạy lại khi sửa file)
```

Giải thích: Node không chạy được TypeScript trực tiếp, nên Nest CLI biên dịch ra `dist/` rồi mới chạy. `main.ts` là điểm vào.

### A2. `src/main.ts` — hàm `bootstrap()`

```
bootstrap()
 -> NestFactory.create(AppModule)                       (main.ts:13)
 -> app.get(ConfigService), app.get(Reflector)          (14-15)
 -> app.useGlobalFilters(new HttpExceptionFilter())     (17)
 -> app.useGlobalInterceptors(new TransformInterceptor) (18)
 -> app.useGlobalPipes(new ValidationPipe({...}))       (19-25)
 -> app.use(cookieParser())                             (27)
 -> app.enableCors({...})                               (28-36)
 -> app.setGlobalPrefix('api')                          (38)
 -> app.enableVersioning({ type: URI, defaultVersion: '1' })  (39-42)
 -> app.use(helmet())                                   (44)
 -> SwaggerModule.setup('docs', ...)                    (60)
 -> app.listen(PORT)                                    (64)
```

Từng dòng quan trọng:

- `NestFactory.create(AppModule)`: Nest đọc `AppModule`, dựng một "cây phụ thuộc" (Dependency Injection): tạo trước các thứ được cần, rồi mới tạo thứ cần chúng.
- `useGlobalFilters(HttpExceptionFilter)`: bắt mọi lỗi ném ra (`throw`) và đổi thành JSON lỗi thống nhất `{statusCode, timestamp, path, error}`.
- `useGlobalInterceptors(TransformInterceptor)`: bọc mọi kết quả thành công thành `{statusCode, message, data}`.
- `useGlobalPipes(ValidationPipe)`: kiểm tra dữ liệu gửi lên theo DTO. `whitelist` bỏ trường lạ, `forbidNonWhitelisted` **từ chối** trường lạ (trả 400 "property … should not exist"), `transform` đổi JSON thành đối tượng DTO.
- `setGlobalPrefix('api')` + `enableVersioning(URI, '1')`: mọi route có tiền tố `/api/v1/...`. Đó là lý do FE gọi `/api/v1/assessments/assignments`.
- `enableCors`: cho phép trình duyệt ở `localhost:3000/4751/5173` gọi sang cổng 8086 (khác cổng = khác origin).
- `listen(PORT)`: PORT lấy từ file `.env` (8086).

### A3. Dựng `AppModule` (`src/app.module.ts`)

Nest tạo theo thứ tự import:

```
ConfigModule.forRoot({ isGlobal: true })   -> đọc file .env thành ConfigService (DATABASE_URL, INTERNAL_SERVICE_KEY, PORT)
PrismaModule -> new PrismaService(configService)
              -> constructor: new PrismaPg({ connectionString: DATABASE_URL }); super({ adapter })
              -> onModuleInit(): this.$connect()          // mở kết nối tới assessment_db
IntegrationsModule -> useFactory(config):
              COURSE_CLIENT_MODE === 'fake' ? new FakeCourseServiceClient : new HttpCourseServiceClient(config)
              // mặc định http: đọc COURSE_SERVICE_URL, INTERNAL_SERVICE_KEY, timeout
AssessmentsModule  -> AssessmentsController, AssessmentsService, RubricsService
PeerReviewModule   -> PeerReviewController, PeerReviewService
providers: APP_GUARD -> InternalAuthGuard   // guard chạy cho MỌI route
```

Khi các Controller được đăng ký, Nest in ra các route như:
`GET /api/v1/assessments/assignments`, `GET /assignments/:id`, `POST /assignments`, `PATCH /assignments/:id`, `DELETE /assignments/:id`, `PUT /assignments/:id/peer-review`.

Đến đây Backend sẵn sàng.

---

## 2. Giai đoạn B: khởi động Frontend

```
cd frontend
npm run dev
 -> "dev": "vite"
 -> Vite đọc vite.config.ts (cổng 3000), đọc .env.development.local
 -> mở dev server; các biến VITE_* được nhúng vào import.meta.env (CHỈ đọc lúc khởi động, sửa .env phải chạy lại)
```

Trình duyệt mở `http://localhost:3000/...`:

```
Vite trả index.html
 -> <div id="root"></div> + <script type="module" src="/src/main.tsx">
 -> main.tsx: createRoot(#root).render(
        <App> <AppProvider> <ConfigProvider> <RouterProvider router={router} />)
 -> RouterProvider đọc router (src/router.tsx, createBrowserRouter([...]))
 -> so khớp URL hiện tại với danh sách route -> render component tương ứng
```

Với UC19, URL thuộc nhóm:

```
/instructor/courses/:courseId/builder            -> element: <LayoutInstructorCourse />  (router.tsx:431)
   index                                         -> <InstructorCourseBuilder />           (trang outline)
   assignments                                   -> <InstructorCourseBuilderAssignments />       (UC19)
   assignments/new                               -> <InstructorCourseBuilderAssignmentCreate />  (UC19.2)
   assignments/:assignmentId                     -> <InstructorCourseBuilderAssignmentDetail />  (UC19.1)
   assignments/:assignmentId/edit                -> <InstructorCourseBuilderAssignmentEdit />    (UC19.3)
   assignments/:assignmentId/peer-review         -> <InstructorCourseBuilderAssignmentPeerReviewEdit /> (UC19.5)
   assignments/:assignmentId/delete              -> <InstructorCourseBuilderAssignmentDelete />  (UC19.4)
```

Route cha `LayoutInstructorCourse` luôn chạy trước, các trang UC19 là con của nó và hiện ở chỗ `<Outlet />`.

---

## 3. Giai đoạn C: vào Course Builder (chuẩn bị cho mọi UC19)

Người dùng: My Courses → bấm **View Structure** → `navigate('/instructor/courses/<uuid>/builder')`.

```
LayoutInstructorCourse()                                   (components/layout/layout.instructor.course.tsx)
 -> useParams()                 // lấy courseId từ URL
 -> useState(structure, loading, errorMessage, assignments)
 -> useEffect(() => { void loadStructure() }, [loadStructure])         // chạy sau khi render lần đầu
      loadStructure()
       -> fetchCourseStructureAPI(courseId)                           // services/course.service.ts
       -> axios.get(`/api/v1/courses/${courseId}/structure`)          // sang Course Service (VITE_BACKEND_URL = 8083)
       -> setStructure(response.data)   -> render lại
 -> useEffect(..., [courseId, pathname])                              // UC19: nạp danh sách Assignment cho sidebar
      -> fetchAssignmentsAPI(courseId) -> setAssignments(res.data?.items ?? null)   // lỗi thì im lặng
 -> return <CourseBuilderNav structure assignments /> + <Outlet context={{structure, refetchStructure, assignments}} />
```

Ý nghĩa:
- `structure.course` (id, name, status) là dữ liệu **thật** của Course Service. Các trang UC19 lấy course từ đây bằng `useOutletContext()` (không còn dùng mock `findInstructorCourse`).
- Effect thứ hai phụ thuộc `pathname` nên mỗi lần đổi trang (ví dụ vừa tạo xong) danh sách Assignment ở sidebar tự nạp lại.

---

## 4. Con đường chung của MỌI request UC19

### 4.1 Phía FE: `src/services/assessment.service.ts`

Mọi hàm đều làm 3 việc: chọn URL, gắn header dev, gọi axios.

```
devHeaders = { x-internal-key, x-user-id, x-organization-id, x-user-role }     (dòng 15-24)
requestConfig = { baseURL: VITE_ASSESSMENT_BACKEND_URL (http://localhost:8086), headers: devHeaders }  (27-30)
```

Header là danh tính **giả** tạm thời (chưa có gateway/đăng nhập). Về sau gateway tự gắn các header này.

`axios` ở đây là instance trong `axios.customize.ts`:

```
axios.get/post/...(url, [data], config)
 -> request interceptor (axios.customize.ts:8): thêm Authorization: Bearer <access_token trong localStorage> (nếu có)
 -> gửi HTTP
 -> response interceptor (30):
      2xx: nếu có response.data.data thì trả về response.data  ({statusCode, message, data})
      lỗi 4xx/5xx: trả về error.response.data (KHÔNG reject!)
```

Hệ quả quan trọng: lỗi HTTP **không** rơi vào `catch`; nó trả về như kết quả bình thường nhưng không có `.data`. Vì vậy các trang kiểm tra `if (!res.data) { hiển thị lỗi }`. `catch` chỉ bắt lỗi mạng (service tắt).

### 4.2 Phía BE: vòng đời một request trong Nest

Thứ tự thật của Nest:

```
Express nhận request
 -> middleware: helmet(), cors, cookieParser()
 -> Guard:       InternalAuthGuard.canActivate()
 -> Interceptor: TransformInterceptor.intercept()  (phần "trước")
 -> Pipe:        ParseUUIDPipe / ValidationPipe
 -> Controller method
 -> Service method  (-> Prisma / gọi service khác)
 -> Interceptor: map(data => ({statusCode, message, data}))   (phần "sau")
 -> trả JSON
 (nếu có throw ở bất kỳ bước nào) -> HttpExceptionFilter -> JSON lỗi
```

**InternalAuthGuard** (`common/guards/internal-auth.guard.ts`):

```
canActivate(context)
 -> reflector.getAllAndOverride(IS_PUBLIC_KEY)            // route có @Public() thì bỏ qua
 -> internalKey = request.headers['x-internal-key']       (34)
 -> expected = configService.getOrThrow('INTERNAL_SERVICE_KEY')   (35-36)
 -> khác nhau -> throw UnauthorizedException (401)        (38-45)
 -> đọc x-user-id, x-organization-id, x-user-role -> parseUserRole      (47-50)
 -> thiếu -> 401 "Missing authenticated user context."    (52-58)
 -> request.user = { userId, organizationId, role, isAuthenticated: true }   (60-65)
 -> return true
```

**Decorator `@User()`** (`common/decorator/customize.ts`) lấy lại `request.user` để truyền vào method controller. **`@ResponseMessage('...')`** gắn chuỗi message để Interceptor đọc.

**TransformInterceptor** (`common/interceptors/transform.interceptor.ts:19-36`): đọc `statusCode` từ response, đọc message bằng `reflector`, rồi `map` kết quả thành `{statusCode, message, data}`. Đây là lý do FE đọc `res.data` (dữ liệu thật nằm trong trường `data`).

### 4.3 Hàm dùng chung `requireInstructor` và `requireOwnCourse` (`assessments.service.ts`)

```
requireInstructor(user)                                   (457-465)
 -> user.role !== 'INSTRUCTOR' hoặc không có organizationId -> 403 FORBIDDEN
 -> trả organizationId

requireOwnCourse(user, courseId)                          (468-480)
 -> this.courses.getAuthoringContext(courseId, user)      // CourseServiceClient (đã tiêm qua DI)
      HttpCourseServiceClient.getAuthoringContext()       (http-course-service.client.ts:41)
       -> fetch(`${COURSE_SERVICE_URL}/api/v1/courses/${courseId}/authoring-context`,
                { headers: x-internal-key + danh tính người gọi, signal: AbortSignal.timeout(5s) })
       -> lỗi mạng/timeout -> 503 COURSE_SERVICE_UNAVAILABLE
       -> 404               -> 404 COURSE_NOT_FOUND
       -> khác 2xx          -> 503
       -> return body.data
      ---- bên course-service ----
      InternalAuthGuard (cùng cơ chế)
       -> CoursesController.getAuthoringContext(id, user)          (@Get(':id/authoring-context'))
       -> CoursesService.getAuthoringContext(courseId, organizationId)
           -> prisma.course.findFirst({ where: { id, organizationId }, include: { chain: { select: { instructorId } } } })
           -> không có -> NotFoundException
           -> return { courseId, organizationId, instructorId, status, locked: lockedAt !== null, disabled: disabledAt !== null }
 -> course.organizationId !== user.organizationId || course.instructorId !== user.userId
      -> 404 "Course not found."   (cố ý trả 404 để không lộ course của người khác — BR-79/BR-287)
 -> trả course context
```

Nghĩa là: **Assessment Service không tự biết ai sở hữu Course**; nó hỏi Course Service rồi so danh tính. `COURSE_CLIENT_MODE=fake` bỏ qua cuộc gọi này (chỉ dùng khi dev, và nó coi mọi course là của người gọi).

---

## 5. UC19 — Xem danh sách Assignment của một Course

URL: `/instructor/courses/:courseId/builder/assignments`

### FE

```
(người dùng bấm "Assignments"/vào URL)
 -> router khớp "assignments" -> <CourseBuilderAssignments />       (pages/instructor/course.builder.assignments.tsx)
 -> useParams() lấy courseId; useOutletContext() lấy structure.course
 -> useState: assignments=[], courseLocked=null, loading=true
 -> useEffect([courseId])  (21-44):
      load()
       -> fetchAssignmentsAPI(courseId)
            -> axios.get('/api/v1/assessments/assignments', { ...requestConfig, params: { courseId: toApiCourseId(courseId) } })
            // toApiCourseId: nếu courseId KHÔNG phải UUID (id mock) thì dùng VITE_DEV_COURSE_ID; UUID thật giữ nguyên
       -> res.data? setAssignments(res.data.items); setCourseLocked(res.data.courseLocked)
          : message.error(assessmentErrorText(res, ...))     // lỗi HTTP trả về dạng giá trị
       -> catch: "Unable to reach the Assessment service."
       -> finally: setLoading(false)
 -> render bảng: assignments.map(...) ; "No Assignments yet." nếu rỗng; "Loading..." khi loading
 -> nút "+ Add Assignment" disabled khi courseLocked !== false   (BR-318: Course Locked không cho tạo mới)
```

### BE

```
GET /api/v1/assessments/assignments?courseId=...
 -> Guard -> Interceptor
 -> ParseUUIDPipe kiểm tra courseId là UUID (không phải -> 400)
 -> AssessmentsController.listAssignments(user, courseId)             (controller:30)
 -> AssessmentsService.listAssignments(user, courseId)                (service:162)
      -> requireInstructor(user)           -> organizationId
      -> requireOwnCourse(user, courseId)  -> course (gọi Course Service)
      -> prisma.assessment.findMany({ where: { organizationId, courseId, kind: 'ASSIGNMENT' },
                                      orderBy: { position: 'asc' }, include: { _count: { select: { submissions: true } } } })
           // SQL: SELECT ... FROM assessments WHERE ... ORDER BY position, kèm đếm submissions
      -> rows.map(a => ({ id, courseId, title, position, peerReviewEnabled, maxConsecutiveAttempts, lockoutHours,
                          locked: a._count.submissions > 0,   // BR-98: có bài nộp thì khóa
                          disabled: a.disabledAt !== null }))
      -> return { ...createPageResponse(items,1,max(len,1),len), courseLocked: course.locked, courseStatus: course.status }
 -> TransformInterceptor: { statusCode: 200, message: 'Assignments retrieved successfully.', data: {meta, items, courseLocked, courseStatus} }
```

Kết quả hiện trên màn hình: bảng 4 cột (Assignment / Peer Review / Attempts / Lock), banner "Course Locked" nếu `courseLocked`.

---

## 6. UC19.1 — Xem chi tiết một Assignment

URL: `.../builder/assignments/:assignmentId`

### FE

```
router -> <CourseBuilderAssignmentDetail />                   (course.builder.assignment.detail.tsx)
 -> useParams(): assignmentId ; useOutletContext(): structure.course
 -> useEffect([assignmentId]) (39-58):
      fetchAssignmentAPI(assignmentId)
       -> axios.get(`/api/v1/assessments/assignments/${assignmentId}`, requestConfig)
      -> res.data ? setAssignment(res.data) : message.error(...)
 -> if (!assignment): hiển thị "Loading Assignment..." hoặc "Assignment not found" + nút Back     (63-73)
 -> có dữ liệu:
      totalPoints = rubric.reduce(sum + maxPoints)
      restricted  = assignment.locked            // BR-98: đã có bài nộp
      banner "Assignment disabled" nếu disabled; banner "Peer Review is off" nếu tắt và Course chưa Locked
      6 ô tham số: Passing score, Estimated effort, Consecutive submissions (n), Temporary lock (m), Peer Review, Rubric
      bảng Rubric, thẻ Submission rules, nút Back / Delete (viền đỏ) / Edit / cấu hình Peer Review
```

### BE

```
GET /api/v1/assessments/assignments/:id
 -> Guard -> Interceptor -> ParseUUIDPipe('id')
 -> AssessmentsController.getAssignment(user, id)             (controller:40)
 -> AssessmentsService.getAssignment(user, id)                (service:198)
      -> findOwnAssignment(user, id)                          (204-211)
           -> requireInstructor(user)
           -> findAssignmentRow(organizationId, id)
                -> prisma.assessment.findFirst({ where: { id, organizationId, kind: 'ASSIGNMENT' },
                                                 include: { rubricCriteria (order by position), _count.submissions } })
           -> không có -> 404 "Assignment not found."
           -> requireOwnCourse(user, assignment.courseId)     // kiểm tra quyền qua Course Service
           -> return { assignment, course }
      -> toDetail(assignment, course.locked)                  (482-515)
           // đổi Decimal -> Number, gom 5 trường peer review thành object peerReview, rubric.map(toResponse)
```

`where ... organizationId` đảm bảo không đọc nhầm dữ liệu của tổ chức khác (cách ly tenant).

---

## 7. UC19.2 — Tạo Assignment

URL: `.../builder/assignments/new`

### FE: component `CourseBuilderAssignmentCreate` (`course.builder.assignment.create.tsx`)

```
render lần đầu: useState cho title, instructions, passingScore, estimatedEffort, consecutiveSubmissions, lockHours, rubric=[newRubricRow()], saving, submitted
mỗi lần render: tính object `errors` (36-52):
   title / instructions: bắt buộc không rỗng
   passingScore:      validateNumber(value, PASSING_SCORE_RULE)       // 0..100
   estimatedEffort:   validateNumber(..., EFFORT_RULE)                // số nguyên >= 1
   consecutiveSubmissions / lockHours: tùy chọn, nếu nhập phải hợp lệ
   rubric: mỗi dòng phải có mô tả và maxPoints là số nguyên dương
người dùng gõ -> onChange -> setState -> render lại (ô lỗi chỉ hiện khi submitted = true)

bấm "Create Assignment" -> handleCreate()                                  (54-93)
 -> setSubmitted(true)
 -> Object.values(errors).some(Boolean) ? message.warning(...) + cuộn tới ô lỗi + return    // CHẶN sớm ở FE
 -> setSaving(true)
 -> createAssignmentAPI({ courseId: toApiCourseId(course.id), title, prompt, passingScore, expectedDurationMinutes,
                          [maxConsecutiveAttempts], [lockoutHours], rubric: rows.map(name = 200 ký tự đầu của mô tả, description, maxPoints) })
       -> axios.post('/api/v1/assessments/assignments', payload, requestConfig)
 -> res.data? message.success + navigate(`${base}/assignments/${created.id}`)   // chuyển sang trang chi tiết
            : message.error(assessmentErrorText(res, ...))
 -> catch: lỗi mạng ; finally: setSaving(false)
```

FE kiểm tra trước chỉ để tiện cho người dùng; BE vẫn kiểm tra lại (không tin FE).

### BE

```
POST /api/v1/assessments/assignments   body: JSON
 -> Guard
 -> ValidationPipe biến JSON thành CreateAssignmentDto và kiểm tra (decorator class-validator):
      courseId @IsUUID ; title @IsString @IsNotEmpty @MaxLength(200) ; prompt @IsOptional @MaxLength(8000)
      passingScore @IsNumber(max 2 chữ số thập phân) @Min(0) @Max(100) ; expectedDurationMinutes @IsInt @Min(1)
      maxConsecutiveAttempts / lockoutHours @IsOptional @IsInt @Min(1)
      rubric @IsArray @ArrayMinSize(1) @ValidateNested  (mỗi phần tử CreateRubricDto)
      trường lạ (ví dụ "locked") -> 400 "property locked should not exist" (forbidNonWhitelisted)
 -> @HttpCode(201)
 -> AssessmentsController.createAssignment(user, dto)                 (controller:72)
 -> AssessmentsService.createAssignment(user, dto)                    (service:64)
```

Từng bước trong service:

```
createAssignment()
 1. requireInstructor(user)                                  (65)
 2. thiếu cả prompt lẫn promptFile -> 400 ASSIGNMENT_PROMPT_REQUIRED   (67-72)
 3. course = requireOwnCourse(user, dto.courseId)            (74)   // hỏi Course Service, kiểm tra chủ sở hữu
 4. course.disabled hoặc status không thuộc DRAFT/REJECTED/PUBLISHED -> 409 COURSE_NOT_EDITABLE    (75-83)   // BR-284
 5. course.locked -> 409 COURSE_LOCKED                       (85-91)   // BR-318
 6. settings = prisma.platformSetting.findFirst(orderBy createdAt desc)   // giá trị mặc định toàn nền tảng
    maxConsecutiveAttempts = dto.x ?? settings.default ?? 3 ; lockoutHours = dto.x ?? settings.default ?? 24   (96-101)   // BR-175
 7. prisma.$transaction(async (tx) => {                      (103)   // tất cả bước sau hoặc cùng thành công, hoặc cùng bị hủy
      a. tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(courseId))`      (105)
         // khóa tư vấn theo course: hai người tạo cùng lúc sẽ xếp hàng, không bị trùng position
      b. last = tx.assessment.aggregate({ where: { courseId, moduleId: null }, _max: { position } })   (107)
      c. created = tx.assessment.create({ data: { organizationId, courseId, kind: 'ASSIGNMENT', title: trim,
             position: (last.max ?? 0) + 1,           // luôn ở cuối cây Course (BR-154)
             passingScore, maxConsecutiveAttempts, lockoutHours,
             isRequired: true,                          // BR-165: Assignment không bao giờ tùy chọn
             prompt, promptFile*, expectedDurationMinutes,
             peerReviewEnabled: false } })              // chấm chéo bật sau bằng UC19.5
      d. rubrics.createMany(tx, organizationId, created.id, dto.rubric)   // RubricsService: tx.rubricCriterion.createMany, position = index + 1
      e. withRubric = tx.assessment.findUniqueOrThrow({ where: { id }, include: assignmentInclude })
      f. tx.outboxEvent.create({ eventType: 'AssignmentCreated', payload: { assignmentId, courseId, expectedDurationMinutes } })
         // Outbox pattern: ghi "sự kiện cần báo" CÙNG transaction để Course Service cộng thời lượng vào ước tính (BR-51/172). Hiện chưa có bên gửi/nhận.
      return withRubric
    })
 8. return toDetail(assignment, course.locked)
```

Interceptor bọc thành `{statusCode:201, message:'Assignment created successfully.', data: <chi tiết>}` → FE nhận `res.data.id` → `navigate` sang trang chi tiết (UC19.1).

---

## 8. UC19.3 — Cập nhật Assignment

URL: `.../builder/assignments/:assignmentId/edit`

### FE: `CourseBuilderAssignmentEdit`

```
mount -> useEffect: fetchAssignmentAPI(assignmentId) -> setAssignment + đổ giá trị vào các state (title, instructions, passingScore, ...)   (49-79)
tính cờ khóa:
   submissionLocked = assignment.locked        // đã có bài nộp: khóa prompt, rubric, n, m
   scoreLocked      = assignment.courseLocked  // Course Locked: khóa passing score
errors: bỏ qua các trường bị khóa (người dùng không sửa được nên không thể sai)       (111-126)
bấm Save -> handleSave()                                                                (128-171)
 -> validate -> lỗi thì dừng
 -> chỉ đưa vào payload những trường THAY ĐỔI so với bản gốc (title, prompt, passingScore, effort, n, m, rubric nếu rubricChanged)
 -> payload rỗng -> message.info("No changes to save.") và dừng
 -> updateAssignmentAPI(id, payload) -> axios.patch(`/api/v1/assessments/assignments/${id}`, payload, requestConfig)
 -> res.data ? message.success + navigate(detailPath) : message.error(...)
```

Gửi chỉ phần thay đổi để các trường bị khóa mà không đụng tới thì không bị server từ chối nhầm.

### BE: `PATCH /api/v1/assessments/assignments/:id`

```
Guard -> ValidationPipe(UpdateAssignmentDto = PartialType(OmitType(CreateAssignmentDto, ['courseId'])))  // mọi trường đều tùy chọn, không cho đổi courseId
 -> AssessmentsController.updateAssignment(user, id, dto)             (controller:50)
 -> AssessmentsService.updateAssignment(user, id, dto)                (service:219)
      1. requireInstructor ; { assignment, course } = findOwnAssignment(user, id)        (224-225)
      2. course.disabled hoặc status không authorable -> 409 COURSE_NOT_EDITABLE          (228-236)
      3. xây object `data` (chỉ trường thật sự đổi) và danh sách frozenBySubmission:
           title      : đổi thì data.title
           prompt     : nextPrompt != cũ -> data.prompt, frozen.push('prompt')
           promptFile : đổi -> data.promptFile*, frozen.push('prompt file')
           n, m       : khác giá trị cũ -> data..., frozen.push(...)
           rubric     : so sánh bằng JSON (name, description, maxPoints) -> rubricChanged, frozen.push('Rubric')
           không còn prompt lẫn file -> 400 ASSIGNMENT_PROMPT_REQUIRED
      4. frozen không rỗng VÀ assignment._count.submissions > 0 -> 409 ASSIGNMENT_HAS_SUBMISSIONS   (296-301)   // BR-98
      5. passingScore đổi:  course.locked -> 409 PASSING_SCORE_LOCKED ; ngược lại data.passingScore   (303-315)   // BR-319
      6. expectedDurationMinutes đổi -> data (luôn được phép, kể cả Locked)               (317-322)   // BR-173
      7. không có gì đổi -> trả luôn bản hiện tại                                          (324-326)
      8. prisma.$transaction(async (tx) => {                                              (328)
           a. submissions = lockAndCountSubmissions(tx, id)
                // SELECT id FROM assessments WHERE id = ... FOR UPDATE  (khóa dòng) rồi đếm submission
                // nếu lúc này có Learner đang nộp bài, lệnh INSERT submission phải chờ -> kiểm tra BR-98 không bị lọt
           b. frozen không rỗng && submissions > 0 -> 409 (kiểm tra lần 2, an toàn hơn lần 1)
           c. tx.assessment.update({ where:{id}, data })
           d. rubricChanged -> rubrics.replaceAll(tx, ...)   // deleteMany rồi createMany
           e. durationChanged -> tx.outboxEvent.create('AssignmentDurationChanged', {expected, previous})
           f. return tx.assessment.findUniqueOrThrow(include)
         })
      9. return toDetail(updated, course.locked)
```

Có hai lần kiểm tra BR-98 (bước 4 nhanh, bước 8b chắc chắn trong khóa) để tránh "race condition".

---

## 9. UC19.4 — Xóa Assignment

URL: `.../builder/assignments/:assignmentId/delete`

### FE: `CourseBuilderAssignmentDelete`

```
mount -> fetchAssignmentAPI(assignmentId) -> setAssignment                       (22-41)
canDelete = !(assignment.courseLocked && assignment.locked)                       (59)   // BR-92: chỉ chặn khi Locked VÀ đã có bài nộp
bấm xác nhận -> handleDelete()                                                    (61-)
 -> setDeleting(true)
 -> deleteAssignmentAPI(id) -> axios.delete(`/api/v1/assessments/assignments/${id}`, requestConfig)
 -> res.data ? message.success("Assignment deleted.") + navigate(`${base}/assignments`)   // về danh sách
            : message.error(...)
```

### BE: `DELETE /api/v1/assessments/assignments/:id`

```
Guard -> ParseUUIDPipe -> AssessmentsController.deleteAssignment(user, id)       (controller:61)
 -> AssessmentsService.deleteAssignment(user, id)                                (service:380)
      1. requireInstructor ; findOwnAssignment
      2. Course không authorable -> 409 COURSE_NOT_EDITABLE
      3. course.locked && submissions > 0 -> 409 ASSIGNMENT_HAS_DATA              (394-400)   // BR-92 (kiểm tra nhanh)
      4. prisma.$transaction(async (tx) => {
           a. submissions = lockAndCountSubmissions(tx, id)                       // khóa dòng + đếm lại
           b. course.locked && submissions > 0 -> 409 (kiểm tra lần 2)
           c. tx.assessment.delete({ where: { id } })    // Rubric, chu kỳ chấm chéo, bộ đếm... bị xóa theo nhờ ON DELETE CASCADE trong DB
           d. tx.outboxEvent.create('AssignmentDeleted', {...})
         })
      5. return { id }
```

---

## 10. UC19.5 — Cấu hình Peer Review (chấm chéo)

URL: `.../builder/assignments/:assignmentId/peer-review` (mở từ nút trên trang chi tiết).

### FE: `CourseBuilderAssignmentPeerReviewEdit`

```
mount -> fetchAssignmentAPI -> đổ vào state: enabled, reviewers, cycleLength, reviewDeadline, threshold      (30-58)
toggleLocked = assignment.courseLocked        // BR-185: Course Locked thì KHÔNG đổi được bật/tắt, nhưng vẫn sửa tham số
errors = enabled ? [validate reviewers, cycleLength, reviewDeadline, threshold] : []                           (80-87)
bấm Save -> handleSave()                                                                                      (89-125)
 -> có lỗi thì dừng
 -> updatePeerReviewAPI(assignment.id, enabled ? { enabled, reviewersPerSubmission, cycleDays, deadlineDays, scoreGap } : { enabled })
      -> axios.put(`/api/v1/assessments/assignments/${id}/peer-review`, payload, requestConfig)
 -> res.data ? message.success + navigate(detailPath) : message.error(...)
```

### BE: `PUT /api/v1/assessments/assignments/:id/peer-review`

```
Guard -> ValidationPipe(UpdatePeerReviewDto):
     enabled @IsBoolean (bắt buộc)
     reviewersPerSubmission, scoreGap: @ValidateIf(enabled) -> chỉ bắt buộc khi bật
     cycleDays, deadlineDays: @IsOptional @IsInt @Min(1)
 -> PeerReviewController.updateConfig(user, id, dto)             (@Controller('assessments/assignments/:id/peer-review') + @Put())
 -> PeerReviewService.updateConfig(user, assignmentId, dto)      (peer-review.service.ts:20)
      1. { assignment, course } = this.assessments.findOwnAssignment(user, id)     // dùng lại hàm của AssessmentsService
      2. Course không authorable -> 409 COURSE_NOT_EDITABLE                         (30-38)
      3. course.locked && dto.enabled !== assignment.peerReviewEnabled -> 409 PEER_REVIEW_TOGGLE_LOCKED   (40-46)   // BR-185/BR-93
      4. data = { peerReviewEnabled: dto.enabled }
         nếu bật: lấy platformSetting rồi
            peerReviewersPerSubmission = dto.reviewersPerSubmission
            peerReviewCycleDays  = dto.cycleDays  ?? giá trị cũ ?? mặc định nền tảng ?? 7
            peerReviewDeadlineDays = dto.deadlineDays ?? giá trị cũ ?? mặc định ?? 3
            peerReviewScoreGap   = dto.scoreGap
         (tắt chỉ đổi cờ, giữ nguyên tham số cũ)
      5. prisma.assessment.update({ where:{id}, data, include: assignmentInclude })     // BR-269: giá trị mới chỉ áp cho chu kỳ tạo sau
      6. return assessments.toDetail(updated, course.locked)
```

---

## 11. Khi lỗi xảy ra: dòng chảy ngược

```
Service: throw new ConflictException({ code: 'COURSE_LOCKED', message: '...' })
 -> HttpExceptionFilter bắt -> JSON { statusCode: 409, timestamp, path, error: { code, message } }
 -> axios response interceptor (nhánh lỗi): return error.response.data   (không reject)
 -> trang: const res = await ...; if (!res.data) message.error(assessmentErrorText(res, 'fallback'))
```

`assessmentErrorText` lấy `error.message` (hoặc `message`), nếu là mảng (lỗi ValidationPipe) thì nối lại thành một câu.

## 12. Tóm tắt một vòng đầy đủ (ví dụ: tạo Assignment)

```
npm run start:dev -> nest start --watch -> node dist/main.js -> bootstrap() -> NestFactory.create(AppModule)
  -> ConfigModule(.env) -> PrismaService.$connect() -> IntegrationsModule(HttpCourseServiceClient) -> mapRoutes -> listen(8086)
npm run dev -> vite -> index.html -> main.tsx -> RouterProvider -> LayoutInstructorCourse -> loadStructure() -> (Course Service)
Bấm "+ Add Assignment" -> navigate('.../assignments/new') -> CourseBuilderAssignmentCreate()
Điền form -> setState... -> bấm Create -> handleCreate() -> validate (FE) -> createAssignmentAPI() -> axios.post()
  -> [HTTP] -> InternalAuthGuard.canActivate() -> ValidationPipe(CreateAssignmentDto)
  -> AssessmentsController.createAssignment() -> AssessmentsService.createAssignment()
  -> requireInstructor() -> requireOwnCourse() -> HttpCourseServiceClient.getAuthoringContext() -> [HTTP sang 8083] ...
  -> prisma.platformSetting.findFirst() -> prisma.$transaction( advisory lock -> aggregate -> assessment.create -> rubricCriterion.createMany -> outboxEvent.create )
  -> toDetail() -> TransformInterceptor -> JSON 201
  -> axios interceptor -> handleCreate nhận res.data -> message.success() -> navigate('.../assignments/<id>')
  -> CourseBuilderAssignmentDetail() -> fetchAssignmentAPI() -> (UC19.1 ở trên) -> màn hình chi tiết
```

## 13. Mẹo tự học

1. Mở Swagger: `http://localhost:8086/docs` để xem toàn bộ route và thử gọi.
2. Trong trình duyệt bấm F12 → tab Network: mỗi bước ở mục 5-10 sẽ hiện thành một request, xem cả header và response.
3. Đặt `console.log` hoặc breakpoint ở `AssessmentsService.createAssignment` rồi tạo Assignment, đi từng dòng theo mục 7.
4. Test là tài liệu sống: `services/assessment-service/test/unit/assessments-service.unit-test.ts` mô tả từng quy tắc nghiệp vụ bằng ví dụ.
