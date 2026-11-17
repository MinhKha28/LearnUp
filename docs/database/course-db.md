# Course database reference

Database `course_db`. See [conventions](conventions.md) and [Prisma schema and migrations](../../services/course-service/prisma/migrations).

[Mapped Prisma models](../../services/course-service/prisma/schema.prisma).

Schema sources include the [active Published version index](../../services/course-service/prisma/migrations/20261110193000_one_published_course_per_chain/migration.sql).

## Invariants

- `courses.id` identifies a single version; `chain_id` groups versions for history. The partial unique index permits at most one Published version with no deletion timestamp per chain.
- Learning locks a Published course synchronously when creating an enrollment, which preserves the enrolled version before Learning uses its syllabus snapshot.
- Material metadata stores delivery type and storage format so the download path can request the matching provider representation.

## Tables

### `organization_quota_locks`

| Column | PostgreSQL definition |
| --- | --- |
| `organization_id` | `UUID NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE organization_quota_locks ADD CONSTRAINT "organization_quota_locks_pkey" PRIMARY KEY ("organization_id");
```

### `course_chains`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `instructor_id` | `UUID NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE course_chains ADD CONSTRAINT "course_chains_pkey" PRIMARY KEY ("id");
CREATE INDEX "course_chains_organization_id_instructor_id_idx" ON "course_chains"("organization_id", "instructor_id");
```

### `courses`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `chain_id` | `UUID NOT NULL` |
| `version_number` | `INTEGER NOT NULL` |
| `name` | `VARCHAR(200) NOT NULL` |
| `short_description` | `VARCHAR(500)` |
| `training_objectives` | `VARCHAR(2000)` |
| `learning_outcomes` | `VARCHAR(200)[]` |
| `cover_file_id` | `UUID` |
| `expected_completion_days` | `INTEGER NOT NULL` |
| `course_type` | `TEXT NOT NULL` |
| `status` | `TEXT NOT NULL` |
| `locked_at` | `TIMESTAMPTZ` |
| `submitted_at` | `TIMESTAMPTZ` |
| `published_at` | `TIMESTAMPTZ` |
| `archived_at` | `TIMESTAMPTZ` |
| `rejected_at` | `TIMESTAMPTZ` |
| `rejection_reason` | `VARCHAR(1000)` |
| `disabled_at` | `TIMESTAMPTZ` |
| `disabled_reason` | `VARCHAR(1000)` |
| `assignment_minutes` | `INTEGER NOT NULL DEFAULT 0` |
| `assignment_minutes_as_of` | `TIMESTAMPTZ` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |
| `deleted_at` | `TIMESTAMPTZ` |
| `deleted_by` | `UUID` |

```sql
ALTER TABLE courses ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");
ALTER TABLE courses ADD CONSTRAINT "courses_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "course_chains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE courses ADD CONSTRAINT "courses_cover_file_id_fkey" FOREIGN KEY ("cover_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE courses ADD CONSTRAINT ck_courses_status CHECK (status IN ('Draft', 'Submitted', 'Published', 'Rejected', 'Archived', 'Disabled'));
ALTER TABLE courses ADD CONSTRAINT ck_courses_course_type CHECK (course_type IN ('Public', 'Private'));
CREATE INDEX "courses_organization_id_status_idx" ON "courses"("organization_id", "status");
CREATE UNIQUE INDEX "courses_chain_id_version_number_key" ON "courses"("chain_id", "version_number");
CREATE INDEX "courses_organization_id_deleted_at_idx" ON "courses"("organization_id", "deleted_at");
CREATE UNIQUE INDEX "uq_courses_one_active_published_per_chain" ON "courses" ("chain_id") WHERE "status" = 'Published' AND "deleted_at" IS NULL;
```

### `modules`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `course_id` | `UUID NOT NULL` |
| `title` | `VARCHAR(200) NOT NULL` |
| `position` | `INTEGER NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE modules ADD CONSTRAINT "modules_pkey" PRIMARY KEY ("id");
ALTER TABLE modules ADD CONSTRAINT "modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "modules_organization_id_course_id_idx" ON "modules"("organization_id", "course_id");
CREATE UNIQUE INDEX "modules_course_id_position_key" ON "modules"("course_id", "position");
```

### `lessons`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `module_id` | `UUID NOT NULL` |
| `title` | `VARCHAR(200) NOT NULL` |
| `content` | `VARCHAR(20000) NOT NULL` |
| `position` | `INTEGER NOT NULL` |
| `disabled_at` | `TIMESTAMPTZ` |
| `disabled_report_id` | `UUID` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE lessons ADD CONSTRAINT "lessons_pkey" PRIMARY KEY ("id");
ALTER TABLE lessons ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "lessons_organization_id_module_id_idx" ON "lessons"("organization_id", "module_id");
CREATE UNIQUE INDEX "lessons_module_id_position_key" ON "lessons"("module_id", "position");
```

### `materials`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `lesson_id` | `UUID NOT NULL` |
| `material_type` | `TEXT NOT NULL` |
| `title` | `VARCHAR(200) NOT NULL` |
| `is_required` | `BOOLEAN NOT NULL` |
| `file_id` | `UUID NOT NULL` |
| `position` | `INTEGER NOT NULL` |
| `disabled_at` | `TIMESTAMPTZ` |
| `disabled_report_id` | `UUID` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE materials ADD CONSTRAINT "materials_pkey" PRIMARY KEY ("id");
ALTER TABLE materials ADD CONSTRAINT "materials_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE materials ADD CONSTRAINT "materials_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "materials_organization_id_file_id_idx" ON "materials"("organization_id", "file_id");
CREATE UNIQUE INDEX "materials_lesson_id_position_key" ON "materials"("lesson_id", "position");
```

### `media_files`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `purpose` | `TEXT NOT NULL` |
| `status` | `TEXT NOT NULL` |
| `storage_key` | `TEXT NOT NULL` |
| `original_filename` | `VARCHAR(255) NOT NULL` |
| `mime_type` | `VARCHAR(255) NOT NULL` |
| `size_bytes` | `BIGINT NOT NULL` |
| `duration_seconds` | `INTEGER` |
| `word_count` | `INTEGER` |
| `ready_at` | `TIMESTAMPTZ` |
| `released_at` | `TIMESTAMPTZ` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |
| `delivery_type` | `TEXT NOT NULL DEFAULT 'upload'` |
| `storage_format` | `TEXT NOT NULL DEFAULT ''` |

```sql
ALTER TABLE media_files ADD CONSTRAINT "media_files_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "media_files_storage_key_key" ON "media_files"("storage_key");
CREATE INDEX "media_files_organization_id_status_idx" ON "media_files"("organization_id", "status");
```

### `content_reports`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `course_id` | `UUID NOT NULL` |
| `target_type` | `TEXT NOT NULL` |
| `target_id` | `UUID NOT NULL` |
| `owner_instructor_id` | `UUID NOT NULL` |
| `reporter_id` | `UUID NOT NULL` |
| `reason` | `VARCHAR(1000) NOT NULL` |
| `level` | `TEXT NOT NULL` |
| `status` | `TEXT NOT NULL` |
| `due_at` | `TIMESTAMPTZ NOT NULL` |
| `org_decision` | `TEXT` |
| `org_severity` | `TEXT` |
| `org_decision_reason` | `VARCHAR(1000)` |
| `org_decided_by` | `UUID` |
| `org_decided_at` | `TIMESTAMPTZ` |
| `escalation_type` | `TEXT` |
| `escalation_reason` | `VARCHAR(1000)` |
| `escalated_by` | `UUID` |
| `escalated_at` | `TIMESTAMPTZ` |
| `admin_decision` | `TEXT` |
| `admin_severity` | `TEXT` |
| `admin_decision_reason` | `VARCHAR(1000)` |
| `admin_decided_by` | `UUID` |
| `admin_decided_at` | `TIMESTAMPTZ` |
| `revision_requested_at` | `TIMESTAMPTZ` |
| `review_requested_at` | `TIMESTAMPTZ` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE content_reports ADD CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id");
ALTER TABLE content_reports ADD CONSTRAINT "content_reports_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "content_reports_organization_id_status_due_at_idx" ON "content_reports"("organization_id", "status", "due_at");
CREATE INDEX "content_reports_target_type_target_id_idx" ON "content_reports"("target_type", "target_id");
```

### `platform_settings`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `source_as_of` | `TIMESTAMPTZ NOT NULL` |
| `reading_speed_words_per_minute` | `INTEGER NOT NULL DEFAULT 200` |
| `study_minutes_per_day` | `INTEGER NOT NULL DEFAULT 60` |
| `duration_gap_threshold_percent` | `INTEGER NOT NULL DEFAULT 20` |
| `max_video_size_bytes` | `BIGINT NOT NULL DEFAULT 2147483648` |
| `max_video_duration_minutes` | `INTEGER NOT NULL DEFAULT 120` |
| `max_reading_size_bytes` | `BIGINT NOT NULL DEFAULT 52428800` |
| `allowed_video_mime_types` | `TEXT[] DEFAULT ARRAY['video/mp4']::TEXT[]` |
| `allowed_reading_mime_types` | `TEXT[] DEFAULT ARRAY['application/pdf']::TEXT[]` |
| `report_handling_days` | `INTEGER NOT NULL DEFAULT 7` |
| `instructor_violation_threshold` | `INTEGER NOT NULL DEFAULT 3` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE platform_settings ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");
```

### `outbox_events`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `aggregate_type` | `TEXT NOT NULL` |
| `aggregate_id` | `UUID NOT NULL` |
| `event_type` | `TEXT NOT NULL` |
| `organization_id` | `UUID` |
| `payload` | `JSONB NOT NULL` |
| `occurred_at` | `TIMESTAMPTZ NOT NULL` |
| `published_at` | `TIMESTAMPTZ` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |
| `attempts` | `INTEGER NOT NULL DEFAULT 0` |
| `last_error` | `TEXT` |
| `next_attempt_at` | `TIMESTAMPTZ` |

```sql
ALTER TABLE outbox_events ADD CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id");
CREATE INDEX "outbox_events_published_at_idx" ON "outbox_events"("published_at");
CREATE INDEX "outbox_events_aggregate_id_id_idx" ON "outbox_events"("aggregate_id", "id");
```

## Provided to other services

- Course batch metadata, locking, syllabus trees, lesson lookup and assignment duration updates use the [internal course controller](../../services/course-service/src/modules/internal-courses/internal-courses.controller.ts).
- Organization quota usage, instructor chain counts, chain lookup and transfer use the [internal organization controller](../../services/course-service/src/modules/internal-courses/internal-organizations.controller.ts).
- Authorized material playback and reading delivery use the [internal material controller](../../services/course-service/src/modules/internal-courses/internal-materials.controller.ts).
- Review access and course lifecycle events follow the [Course API](../../contracts/openapi/course-service.yaml) and [event catalog](../../contracts/events/README.md).
