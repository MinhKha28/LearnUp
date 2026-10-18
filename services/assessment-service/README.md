# assessment-service

NestJS + Prisma 7 service for LearnUP.

Database: `assessment_db`
Port: `8086`

The Prisma schema follows `LearnUP_Database_Guide.docx` service ownership and table boundaries.

## Demo data (dev only)

```bash
npm run prisma:migrate
npm run db:seed
```

`prisma/seed.ts` is safe to run again (every row is an upsert on a fixed id) and refuses to run when `NODE_ENV=production`.
It creates the default `platform_settings` row and demo Assignments (with Rubric) for the Courses seeded by
course-service, reusing the same ids for organizations, instructors and courses.

Run `npm run db:seed` in `services/course-service` first: this service asks Course Service for the owner, status and
Locked flag of a Course before it lets you create, edit or delete an Assignment.

### Demo of UC25.4 (a Learner leaves an optional Course)

learning-service asks `GET /api/v1/internal/learners/:learnerId/courses/:courseId/assessment-activity` (BR-131) to decide
whether leaving deletes the Enrollment (no assessment data) or keeps it as Withdrawn. To demo the real answer:

```bash
npm run db:seed:withdrawal-demo   # safe to run again; refuses NODE_ENV=production
```

It uses the two Courses and Học viên 4 of `learning-service/prisma/withdrawal-demo-fixture.ts`:

| Course | assessment data of Học viên 4 | learning-service does |
| --- | --- | --- |
| X `…c0020000005c` | none (the seed stops if it finds some) | deletes the Enrollment |
| Y `…c00200000097` | one optional Quiz and one submitted attempt | keeps it as Withdrawn |

Then run assessment-service, and keep learning-service on `ASSESSMENT_CLIENT_MODE=http` with `ASSESSMENT_SERVICE_URL`
pointing at this service (`docker-compose.yml` sets both). Stop assessment-service and try to leave a Course to see the
503 (`ASSESSMENT_UNAVAILABLE`): the answer is never guessed.

| Course (course-service seed) | Demo Assignment |
| --- | --- |
| An toan lao dong v2 (Published) | Peer Review ON |
| Bao mat thong tin (Published) | Peer Review off |
| Quy trinh noi bo (Published) | Has a submission, so Instructions / Rubric / n / m are read-only |
| Nhap mon san pham (organization B) | For checking tenant isolation |
| Ky nang giao tiep (Draft) | None, use it to try creating an Assignment |

### Demo data for the identity the UI sends

The Course UI sends user `3333…` / organization `2222…` (see `course.service.ts`). `npm run db:seed` in `course-service` creates
10 Courses for it, one per case, and this seed adds Assignments to them:

| Course (course-service seed) | Case | Assignments |
| --- | --- | --- |
| Workplace Safety Essentials | Draft | none, use it to try creating one |
| Data Security Basics | Published, not Locked | Peer Review ON |
| Customer Service Fundamentals | Published and Locked | one with 2 submissions (frozen, BR-98), one without; no new Assignment (BR-318) |
| Onboarding for New Hires | Submitted | one, nothing can be edited (BR-285) |
| Remote Work Etiquette | Rejected | one, editable like a Draft |
| Fire Safety Basics v1 / v2 | Archived / Published (version chain) | v1 has one with a submission, v2 has none |
| Legacy Compliance Training | Disabled | one disabled by the Organizer (BR-239) |
| Executive Leadership Program | Private, Published | Peer Review ON |
| Blank Draft | Draft without Modules | none |

## Talking to Course Service

Course owner, status and the Locked flag are owned by Course Service, so `src/integrations/` holds a client for it
(same layout as `tenant-service/src/integrations`). `COURSE_CLIENT_MODE` picks the implementation:

| Variable | Meaning |
| --- | --- |
| `COURSE_CLIENT_MODE` | `http` (default) calls Course Service. `fake` does not call it at all, see below. |
| `COURSE_SERVICE_URL` | Course Service address (default `http://localhost:8083`). |
| `COURSE_SERVICE_TIMEOUT_MS` | Timeout of that call (default `5000`). |
| `INTERNAL_SERVICE_KEY` | Sent as `x-internal-key`, must match Course Service. |
| `FAKE_COURSE_STATUS` | Fake mode only: Course status, default `Draft` (try `Submitted`, `Published`). |
| `FAKE_COURSE_LOCKED` | Fake mode only: `true` makes every Course Locked. |

`fake` lets you run and try this service without Course Service. **It treats every Course as owned by the caller, so
the owner check does not apply: use it for local work only.** Errors from the client carry a `code`:
`COURSE_NOT_FOUND` (404) and `COURSE_SERVICE_UNAVAILABLE` (503).

## Prompt file (Cloudinary)

An Assignment can have one PDF as its prompt (BR-320: one file, PDF, 50 MB at most) besides or instead of the text.

1. `POST /api/v1/assessments/assignments/prompt-file` (multipart field `file`) stores it in Cloudinary
   (`learnup/<organizationId>/assignments/prompts`, resource type `raw`) and returns
   `{ fileKey, fileName, mimeType, sizeBytes }`.
2. Send that object as `promptFile` when creating or updating the Assignment (`promptFile: null` removes it).
   Only keys inside the caller's own prompt folder are accepted; the type is always PDF.
3. `GET /api/v1/assessments/assignments/:id/prompt-file` downloads it (the Instructor in charge only); the service
   fetches it from Cloudinary and sends it on.

Storage comes from the shared `@learnup/ts-storage` library (see `libraries/ts-storage`), wired like course-service in
`src/infrastructure/storage`. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in `.env`;
the service does not start without them. Build the library once before `npm install`:
`cd libraries/ts-storage && npm install && npm run build`.

## Tests

```bash
npm run test:unit         # about 1 second, needs nothing running
npm run test:integration  # about 20 seconds, builds first, needs Postgres
npm test                  # both
```

They use `node:test` through `ts-node`, like `learning-service`, so nothing extra is installed.

- **Unit** (`test/unit`): the UC19 business rules (BR-79, BR-92, BR-98, BR-165, BR-173, BR-185, BR-284, BR-318,
  BR-319...) with Prisma and Course Service replaced by fakes, request validation, and the two Course clients.
- **Integration** (`test/integration`): the real service over HTTP and real Postgres: guards, every rule, the outbox rows,
  the cascade on delete, and a submission arriving while an update is running (row lock).

The integration tests create and drop their own database (`assessment_it_<pid>_<time>`) on the server in
`DATABASE_URL`, so they never touch `assessment_db`. They start the service from `dist/` and fake Course Service
themselves, and refuse to run when `NODE_ENV=production`.
