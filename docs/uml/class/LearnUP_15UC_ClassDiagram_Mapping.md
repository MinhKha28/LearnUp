# LearnUP: 15 UC Class Diagram Mapping

## Workspace and sources

- Inspected branch: `chore/add-sequence-diagram-skill`
- HEAD: `8d105f6d2b2b4bf3326425fc1ca55db5e8b61dcf`
- Existing working-tree state before these outputs: `docs/uml/docs/` and the local sequence diagrams listed below were untracked. They were read as evidence and left untouched.
- Class skill read from `.agents/skills/learnup-drawio-class-diagram/`: `SKILL.md`, `references/learnup-class-conventions.md`, `references/LearningPersistence_ClassDiagram.puml`, and `scripts/validate_puml.py`.
- Sequence skill read from `.agents/skills/learnup-drawio-sequence-diagram/`: `SKILL.md` and `references/learnup-conventions.md`.
- Business documents read from `docs/uml/docs/LearnUP_UseCase.docx` and `docs/uml/docs/LearnUP_QuyTacNghiepVu.docx`. The Use Case sections for UC14–UC17 and UC21 were reviewed, along with BR-51, BR-79, BR-285, BR-286, BR-287 and BR-293 in the Business Rules document.
- The prompt also names `LearnUP_Database_Guide.docx`, `LearnUP_Service_Architecture.docx`, `LearnUP_Task_Assignment_v1.2.docx`, and `2769_CT_SEP490_06_CT_Report7_FinalProjectReport_edit.pdf`. They were not available in the inspected workspace and were not used.
- Sequence diagrams were enumerated and checked under `docs/uml/sequence/`. All 15 scoped UC sequence files exist locally. These diagrams were treated as navigation evidence and checked against current source; they were not treated as proof by themselves.
- Source code is the evidence for implemented classifiers, members and links. The two Word documents provide business scope and rule context.

## UC coverage matrix

| UC | Actor / Word section | Relevant BR | Sequence path / status | UI and API evidence | Controller / service / repository evidence | Primary diagram |
|---|---|---|---|---|---|---|
| UC14 — Xem Course phụ trách | Instructor; UseCase §UC14 | BR-79, BR-287 | `docs/uml/sequence/UC14_SequenceDiagram.puml` — present | `frontend/src/pages/instructor/my.courses.tsx`; `course.service.ts` `fetchManagedCoursesAPI`, GET `/api/v1/courses` | `CoursesController.findAll` → `CoursesService.findAll` → `CoursesRepository.findInstructorCourses`; `LearningClient.getCourseLearnerCounts` | [CourseViews](CourseViews_ClassDiagram.puml) |
| UC14.1 — Xem chi tiết Course | Instructor; UseCase §UC14.1 | BR-51, BR-79, BR-287 | `docs/uml/sequence/UC14.1_SequenceDiagram.puml` — present | `frontend/src/pages/instructor/course.detail.tsx`; GET `/api/v1/courses/{courseId}` | `CoursesController.findDetail` → `CoursesService.findDetail` → `CoursesRepository.findDetail`, `calculateEstimatedDurationMinutes` | [CourseViews](CourseViews_ClassDiagram.puml) |
| UC14.2 — Tạo Course | Instructor; UseCase §UC14.2 | BR-79 | `docs/uml/sequence/UC14.2_SequenceDiagram.puml` — present | `frontend/src/pages/instructor/course.create.tsx`; POST `/api/v1/courses`, POST `/api/v1/courses/cover` | `CoursesController.create`/`uploadCover` → `CoursesService.create`/`uploadCover` → `CoursesRepository.createCourse`/`createCourseCoverMediaFile` | [CourseManagement](CourseManagement_ClassDiagram.puml) |
| UC14.3 — Cập nhật thông tin Course | Instructor; UseCase §UC14.3 | BR-79, BR-285 | `docs/uml/sequence/UC14.3_SequenceDiagram.puml` — present | `frontend/src/pages/instructor/course.edit.tsx`; PUT `/api/v1/courses/{courseId}` | `CoursesController.update` → `CoursesService.updateCourse` → `CoursesRepository.updateCourse` | [CourseManagement](CourseManagement_ClassDiagram.puml) |
| UC15 — Xem cấu trúc chương trình | Instructor; UseCase §UC15 | BR-79, BR-285 | `docs/uml/sequence/UC15_SequenceDiagram.puml` — present | Course Builder; GET `/api/v1/courses/{courseId}/structure` | `CoursesController.getStructure` → `CoursesService.getStructure` → `CoursesRepository.findStructure` | [CurriculumAndLessonManagement](CurriculumAndLessonManagement_ClassDiagram.puml) |
| UC15.1 — Thêm Module | Instructor; UseCase §UC15.1 | BR-79, BR-285 | `docs/uml/sequence/UC15.1_SequenceDiagram.puml` — present | Builder `modules/new`; POST `/api/v1/courses/{courseId}/modules` | `CoursesController.createModule` → `CoursesService.createModule` → `CoursesRepository.createModule` | [CurriculumAndLessonManagement](CurriculumAndLessonManagement_ClassDiagram.puml) |
| UC15.2 — Thêm Lesson | Instructor; UseCase §UC15.2 | BR-79, BR-285 | `docs/uml/sequence/UC15.2_SequenceDiagram.puml` — present | Builder `modules/{moduleId}/lessons/new`; POST `/api/v1/courses/{courseId}/modules/{moduleId}/lessons` | `CoursesController.createLesson` → `CoursesService.createLesson` → `CoursesRepository.createLesson` | [CurriculumAndLessonManagement](CurriculumAndLessonManagement_ClassDiagram.puml) |
| UC15.3 — Cập nhật cấu trúc chương trình | Instructor; UseCase §UC15.3 | BR-79, BR-285 | `docs/uml/sequence/UC15.3_SequenceDiagram.puml` — present | Builder `structure/edit`; PUT `/api/v1/courses/{courseId}/structure` | `CoursesController.updateStructure` → `CoursesService.updateStructure` → `CoursesRepository.updateStructure` | [CurriculumAndLessonManagement](CurriculumAndLessonManagement_ClassDiagram.puml) |
| UC16 — Xem chi tiết Lesson | Instructor; UseCase §UC16 | BR-79, BR-285 | `docs/uml/sequence/UC16_SequenceDiagram.puml` — present | Builder `lessons/{lessonId}`; GET `/api/v1/courses/{courseId}/lessons/{lessonId}` | `CoursesController.findLessonDetail` → `CoursesService.findLessonDetail` → `CoursesRepository.findLessonDetail` | [CurriculumAndLessonManagement](CurriculumAndLessonManagement_ClassDiagram.puml) |
| UC16.1 — Cập nhật nội dung Lesson | Instructor; UseCase §UC16.1 | BR-79, BR-285 | `docs/uml/sequence/UC16.1_SequenceDiagram.puml` — present | Builder `lessons/{lessonId}/content/edit`; PUT `/api/v1/courses/{courseId}/lessons/{lessonId}/content` | `CoursesController.updateLessonContent` → `CoursesService.updateLessonContent` → `CoursesRepository.findLessonForContentUpdate`/`updateLessonContent` | [CurriculumAndLessonManagement](CurriculumAndLessonManagement_ClassDiagram.puml) |
| UC17 — Xem danh sách học liệu | Instructor; UseCase §UC17 | BR-79, BR-285, BR-288 | `docs/uml/sequence/UC17_SequenceDiagram.puml` — present | Builder `lessons/{lessonId}/materials`; GET Lesson detail returns materials | `CoursesController.findLessonDetail` → `CoursesService.findLessonDetail` → `CoursesRepository.findLessonDetail` | [LearningMaterialManagement](LearningMaterialManagement_ClassDiagram.puml) |
| UC17.1 — Thêm học liệu Video | Instructor; UseCase §UC17.1 | BR-151, BR-286, BR-288 | `docs/uml/sequence/UC17.1_SequenceDiagram.puml` — present | `materials/video/new`; upload context GET and POST `/materials/videos` | `CoursesController.getVideoUploadContext`/`uploadVideoMaterial` → same service methods → `CoursesRepository.findLessonForMaterialUpload`, settings/usage, `createVideoMaterialWithQuota`; `TenantClient` and storage provider | [LearningMaterialManagement](LearningMaterialManagement_ClassDiagram.puml) |
| UC17.2 — Thêm học liệu Reading | Instructor; UseCase §UC17.2 | BR-51, BR-151, BR-286, BR-288, BR-293 | `docs/uml/sequence/UC17.2_SequenceDiagram.puml` — present | `materials/reading/new`; upload context GET and POST `/materials/readings` | `CoursesController.getReadingUploadContext`/`uploadReadingMaterial` → same service methods → `CoursesRepository.findLessonForMaterialUpload`, settings/usage, `createReadingMaterialWithQuota`; `TenantClient` and storage provider | [LearningMaterialManagement](LearningMaterialManagement_ClassDiagram.puml) |
| UC21 — Xem Course tổ chức | Organizer; UseCase §UC21 | Organizer scope | `docs/uml/sequence/UC21_SequenceDiagram.puml` — present | `frontend/src/pages/organizer/courses.tsx`; GET `/api/v1/courses/organization` | `CoursesController.findOrganizationCourses` → `CoursesService.findOrganizationCourses` → `CoursesRepository.findOrganizationCourses`; Tenant and Learning clients enrich rows | [OrganizationCourseViews](OrganizationCourseViews_ClassDiagram.puml) |
| UC21.1 — Xem Course chờ duyệt | Organizer; UseCase §UC21.1 | Submitted filter | `docs/uml/sequence/UC21.1_SequenceDiagram.puml` — present | Organizer courses/approvals view; same GET `/api/v1/courses/organization` with `status=Submitted` | Same list method chain as UC21; `OrganizationCourseListQueryDto.status` carries the filter | [OrganizationCourseViews](OrganizationCourseViews_ClassDiagram.puml) |

All 15 requested UCs have a primary diagram. No out-of-scope UC appears in this matrix.

## Diagram grouping decision

| Seed group | Final diagram | Decision |
|---|---|---|
| CD01 Course Management (UC14 family) | `CourseManagement_ClassDiagram.puml` + `CourseViews_ClassDiagram.puml` | Split into authoring (UC14.2/14.3) and read views (UC14/14.1). The original combined view had three DTO branches, two clients, a storage interface and several data-model links around the same core chain; this produced a dense crossing layout. The two smaller diagrams retain the relevant shared classes in each local context. |
| CD02 Curriculum Management (UC15 family) | `CurriculumAndLessonManagement_ClassDiagram.puml` | Combined with CD03. |
| CD03 Lesson Management (UC16 family) | `CurriculumAndLessonManagement_ClassDiagram.puml` | Combined with CD02 because the same controller, service, repository, PrismaService and Course–Module–Lesson structure implement both groups. This keeps the shared backend visible once in one diagram. |
| CD04 Material Management (UC17 family) | `LearningMaterialManagement_ClassDiagram.puml` | Kept. Upload context, subscription policy, storage provider, quota transaction and material/file models form a distinct, denser subsystem. |
| CD05 Organization Course Views (UC21 family) | `OrganizationCourseViews_ClassDiagram.puml` | Kept. Organizer filtering shares the course backend but uses a separate query DTO and calls both Tenant and Learning clients to enrich results. |

Five final diagrams are used after splitting the original Course Management group and combining Curriculum with Lesson Management. No UC-specific placeholder diagrams were added.

## Class inventory

Paths and line numbers refer to the inspected working tree at the recorded HEAD.

| Classifier | Kind / owner | Selected fields or operations | Source evidence | UC use and reason |
|---|---|---|---|---|
| CoursesController | class / course-service | retained `coursesService`; only UC-relevant handler methods | `services/course-service/src/modules/courses/courses.controller.ts:35-257` | All groups; direct local entry point and service association. |
| CoursesService | class / course-service | retained repository, TenantClient, LearningClient and storage fields; selected use case methods | `services/course-service/src/modules/courses/courses.service.ts:44-50,52-130,164-194,195-368,376-509,534-588,660-700,728-780,803-965,986-1057,1091-1625` | All groups; central feature logic and retained collaborators. |
| CoursesRepository | class / course-service | retained PrismaService; relevant read/write/query methods | `services/course-service/src/modules/courses/courses.repository.ts:9-10,12-90,167-237,239-350,404-490,521-721,723-880,882-934,937-1112,1114-1300` | All groups; local persistence boundary. |
| PrismaService | class / course-service | shown as an empty-member persistence dependency | `services/course-service/src/infrastructure/prisma/prisma.service.ts:5-20`; injected in repository constructor at `courses.repository.ts:10` | All groups; retained repository field and actual Prisma service. Parent `PrismaClient` omitted as framework/generated detail. |
| TenantClient | class / course-service | HTTP/config fields; instructor and upload policy client methods | `services/course-service/src/infrastructure/clients/tenant/tenant.client.ts:14-18,31-62,64-100` | Course/organization/material groups; retained by CoursesService and invoked by scoped features. Remote Tenant classes/database excluded. |
| LearningClient | class / course-service | HTTP/config fields; learner-count request | `services/course-service/src/infrastructure/clients/learning/learning.client.ts:13-17,30-63` | Course/organization groups; retained by CoursesService and used to enrich course listings. Remote Learning classes/database excluded. |
| IStorageProvider | interface / `libraries/ts-storage` | upload, delete, URL operations | `libraries/ts-storage/src/interfaces/storage.interface.ts:47-54`; injected token/property in `courses.service.ts:49` | Course/material groups; service holds the interface. |
| CloudinaryStorageProvider | class / `libraries/ts-storage` | upload, delete, URL operations | `libraries/ts-storage/src/providers/cloudinary/cloudinary.provider.ts:19,31-62,73-99` | Material group; actual class declares `implements IStorageProvider`. External Cloudinary platform is not a class box. |
| CourseListQueryDto | class DTO / course-service | pagination, search, course type/status and locked filters | `services/course-service/src/modules/courses/dto/course-list-query.dto.ts:18-52` | UC14; only list inputs used by the endpoint; shown in CourseViews. |
| CreateCourseDto | class DTO / course-service | editable creation fields | `services/course-service/src/modules/courses/dto/create-course.dto.ts:15-49` | UC14.2; direct controller parameter; shown in CourseManagement. |
| UpdateCourseDto | class DTO / course-service | course metadata and cover fields | `services/course-service/src/modules/courses/dto/update-course.dto.ts:1-65` | UC14.3; direct controller/service parameter; shown in CourseManagement. |
| CreateCourseModuleDto | class DTO / course-service | title | `services/course-service/src/modules/courses/dto/create-course-module.dto.ts:3-8` | UC15.1. |
| CreateCourseLessonDto | class DTO / course-service | title and content | `services/course-service/src/modules/courses/dto/create-course-lesson.dto.ts:3-12` | UC15.2. |
| UpdateCourseStructureDto, StructureModuleDto, StructureLessonDto | class DTOs / course-service | nested IDs, titles and child arrays | `services/course-service/src/modules/courses/dto/update-course-structure.dto.ts:12-44` | UC15.3; nested DTO types create typed associations. |
| UpdateLessonContentDto | class DTO / course-service | content | `services/course-service/src/modules/courses/dto/update-lesson-content.dto.ts:3-11` | UC16.1. |
| OrganizationCourseListQueryDto | class DTO / course-service | pagination, status/type, instructor and submitted date filters | `services/course-service/src/modules/courses/dto/organization-course-list-query.dto.ts:20-58` | UC21/21.1; one list query supports Submitted filtering. |
| CreateVideoMaterialDto, CreateReadingMaterialDto | class DTOs / course-service | title and `isRequired` | `services/course-service/src/modules/courses/dto/create-video-material.dto.ts:1-20`; `.../create-reading-material.dto.ts:1-20` | UC17.1/17.2; upload inputs. |
| CourseChain, Course, CourseModule, Lesson, Material, MediaFile | PrismaModel / course-service | only fields that clarify assigned course, curriculum, material and file data | `services/course-service/prisma/schema.prisma:18-60,67-102,104-146` | Included in the diagrams where directly queried or written. Not modeled as behavioral entities. |

## Relationship evidence

| From | UML relation | To | Evidence and source | Lifetime / cardinality decision |
|---|---|---|---|---|
| CoursesController | navigable association | CoursesService | Constructor property `private readonly coursesService`; `courses.controller.ts:36`. | Retained field; no ownership diamond. |
| CoursesService | navigable association | CoursesRepository | Constructor property; `courses.service.ts:45-50`. | Retained field; no ownership diamond. |
| CoursesService | navigable association | TenantClient | Constructor property and use sites; `courses.service.ts:45-50,472,1009,1364`. | Retained field; remote service is reached through local client. |
| CoursesService | navigable association | LearningClient | Constructor property and calls; `courses.service.ts:45-50,113-116,474`. | Retained field; no direct remote entity relation. |
| CoursesService | navigable association | IStorageProvider | Constructor property `storage`; `courses.service.ts:49,563,616-637,1215-1235,1549-1565`. | Retained interface reference. |
| CloudinaryStorageProvider | realization | IStorageProvider | Explicit `implements`; `libraries/ts-storage/src/providers/cloudinary/cloudinary.provider.ts:19`. | Genuine interface implementation. |
| CoursesRepository | navigable association | PrismaService | Constructor property; `courses.repository.ts:10`. | Retained field. |
| CoursesRepository | dependency | CourseChain, Course, CourseModule, Lesson, Material, MediaFile | Actual Prisma delegate reads/writes/aggregates; examples `courses.repository.ts:53-90,239-350,882-934,937-1300`. | Prisma data access; no false live-object field association. |
| CoursesController | dependency | UC DTOs | Handler parameters and direct forwarding; `courses.controller.ts:40,69,81-97,108-112,122,136-176,207-257`. | Temporary typed parameter use. |
| UpdateCourseStructureDto | navigable association | StructureModuleDto | `modules: StructureModuleDto[]`; `update-course-structure.dto.ts:38-44`. | Typed nested collection. |
| StructureModuleDto | navigable association | StructureLessonDto | `lessons: StructureLessonDto[]`; `update-course-structure.dto.ts:22-35`. | Typed nested collection. |
| CourseChain | plain association | Course | Prisma fields `CourseChain.courses` and required `Course.chain`; `schema.prisma:25,57`. | Multiplicity shown as 1 to 0..* from required `chainId` plus collection. Not composition; cascade alone is insufficient. |
| Course | plain association | MediaFile | Optional `Course.coverFileId` relation and inverse `MediaFile.covers`; `schema.prisma:40,58,142-143`. | No multiplicity; only structural schema relationship is asserted. |
| Course | plain association | CourseModule | `Course.modules` and `CourseModule.course`; `schema.prisma:57-60,76`. | No composition despite cascade. |
| CourseModule | plain association | Lesson | `CourseModule.lessons` and `Lesson.module`; `schema.prisma:76-77,96-97`. | No composition despite cascade. |
| Lesson | plain association | Material | `Lesson.materials` and `Material.lesson`; `schema.prisma:97,118`. | No composition despite cascade. |
| Material | plain association | MediaFile | `Material.file` and `MediaFile.materials`; `schema.prisma:111,119,142`. | No composition; file can have an independent lifecycle. |

## AS-IS and specification gaps

| UC / topic | Word expectation | Current source observation | Sequence observation / treatment |
|---|---|---|---|
| UC21.1 | View courses awaiting Organizer decision; UC21.3 approval is outside this task. | No dedicated pending-review service method was found. `findOrganizationCourses` accepts `OrganizationCourseListQueryDto.status`; the UI supplies the Submitted filter. | UC21.1 sequence exists and follows the filtered read. Mapped to the same diagram as UC21; no approval action modeled. |
| UC14.1 / BR-51 | Estimated duration includes required videos/readings and assignment minutes; optional materials are excluded. | `CoursesService.findDetail` asks the repository for reading speed then invokes `calculateEstimatedDurationMinutes`; SQL in `courses.repository.ts:329-366` filters Required, non-disabled materials and uses wordCount for reading time. | Reflected as service/repository operations only; no synthetic BR operation or upload action is added. |
| UC17.2 / BR-293 | Unreadable Reading text counts as zero and warns the Instructor. | `reading-text-extractor.ts` supplies module-level `extractReadingText`/word counting; upload persists wordCount and returns extraction warning. It is not a class. | UC17.2 sequence exists; no invented `ReadingTextExtractor` class. |
| UC17.1/17.2 / BR-286, BR-151 | Locked Course permits only optional new materials; subscription storage policy still applies. | Service checks Locked/required and policy, repository rechecks quota and state within its transaction. | Video/Reading details remain in their material diagram; the BR rules do not become classifiers or operations. |
| UC14.3 / UC15.3 / UC16.1 / BR-285 | Submitted Course blocks instructor edits. | Update service/repository paths restrict editable states; relevant repository operations are present. | Shown as implemented methods; other submission/withdrawal operations remain out of scope. |
| Instructor ownership / BR-79 and BR-287 | Instructor can edit only assigned Course; owner transfer has its own UC. | Relevant queries scope Course/lesson access through organization and `CourseChain.instructorId`. | IDs/ownership are represented through local Course/CourseChain models; no remote Tenant user association is inferred. |

No missing implementation was identified for the 15 selected read/create/update operations during this trace. This is a scoped trace, not a repository-wide completeness claim.

## Exclusions

- UC20, UC21.3, UC14.4, UC14.5, UC17.3 and other out-of-scope operations are not mapped as use cases or drawn as classes/methods.
- Actors, React screens, ApiGateway, physical databases, Cloudinary platform, REST/Kafka messages and remote service internals are not class classifiers.
- `extractReadingText` and `countWords` are module-level utilities, not invented classes.
- `CourseStatus`/`CourseType` are TypeScript constants and union types in `course-values.ts`, not declared enums; they are shown only as member types, not enum boxes.
- `PlatformSetting` is omitted from the material diagrams to keep attention on the feature's owned classifier structure; its reads are listed in the repository evidence.
- No cross-service database links, foreign-key composition, cascade-based ownership, or unverified multiplicities were inferred.

## Verification and working-tree safety

| Artifact / check | Static detailed validator | Render | draw.io import |
|---|---|---|---|
| `CourseManagement_ClassDiagram.puml` | PASS | Not run — Java is available but no local PlantUML renderer/JAR was located | Not tested — draw.io integration unavailable |
| `CourseViews_ClassDiagram.puml` | PASS | Not run — renderer unavailable | Not tested — draw.io integration unavailable |
| `CurriculumAndLessonManagement_ClassDiagram.puml` | PASS | Not run — renderer unavailable | Not tested — draw.io integration unavailable |
| `LearningMaterialManagement_ClassDiagram.puml` | PASS | Not run — renderer unavailable | Not tested — draw.io integration unavailable |
| `OrganizationCourseViews_ClassDiagram.puml` | PASS | Not run — renderer unavailable | Not tested — draw.io integration unavailable |

Validator command run for each file: `python .agents/skills/learnup-drawio-class-diagram/scripts/validate_puml.py <file> --mode detailed`. The validator checks structure and a supported PlantUML subset; source fidelity and layout were separately reviewed against the evidence above. The draw.io PlantUML Diagram importer is known to omit some formatting; use PlantUML Image mode when visibility text and line routing must be preserved exactly, or manually repair native shapes after import.

Five `.puml` diagrams and this mapping file are present under `docs/uml/class/`. The Course Management group was split into authoring and read-view diagrams to reduce relationship crossings. The class-diagram skill and its validation/reference files were updated to enforce title-free diagrams, explicit visibility text, relationship labels and orthogonal routing. Existing Word files and sequence diagrams remain untouched. No application code or schemas were edited; no commit or push was made.
