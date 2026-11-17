# Learning database reference

Database `learning_db`. See [conventions](conventions.md) and [Prisma schema and migrations](../../services/learning-service/prisma/migrations).

[Mapped Prisma models](../../services/learning-service/prisma/schema.prisma).

## Invariants

- Each learner has one enrollment per course version. Course and material snapshot IDs preserve the version-specific syllabus used for progress.
- The stored lifecycle and effective due date are distinct. The read path derives Overdue from the current enrollment and its deadline.
- Completion eligibility changes enqueue evaluation in the same transaction. The completion worker stores the score snapshot and writes the enrollment event when the transition succeeds.
- Video coverage uses a multirange to merge overlapping watched intervals. The resume position is stored separately because a resume point does not establish watched coverage.

## Tables

### `enrollments`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `learner_id` | `UUID NOT NULL` |
| `course_id` | `UUID NOT NULL` |
| `enrollment_type` | `TEXT NOT NULL` |
| `status` | `TEXT NOT NULL DEFAULT 'NotStarted'` |
| `enrolled_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `assigned_at` | `TIMESTAMPTZ` |
| `expected_completion_days` | `INTEGER` |
| `base_due_at` | `TIMESTAMPTZ` |
| `extension_seconds` | `BIGINT NOT NULL DEFAULT 0` |
| `due_at` | `TIMESTAMPTZ` |
| `video_completion_percent` | `INTEGER NOT NULL` |
| `first_activity_at` | `TIMESTAMPTZ` |
| `completed_at` | `TIMESTAMPTZ` |
| `completed_late` | `BOOLEAN` |
| `withdrawn_at` | `TIMESTAMPTZ` |
| `withdrawn_reason` | `TEXT` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `completion_snapshot` | `jsonb` |
| `due_timezone` | `TEXT` |

```sql
ALTER TABLE enrollments ADD CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id");
ALTER TABLE enrollments ADD CONSTRAINT "enrollments_course_id_organization_id_fkey" FOREIGN KEY ("course_id", "organization_id") REFERENCES "course_version_snapshots"("course_id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE enrollments ADD CONSTRAINT "ck_enrollments_type" CHECK ("enrollment_type" IN ('Required', 'Optional'));
ALTER TABLE enrollments ADD CONSTRAINT "ck_enrollments_status" CHECK ("status" IN ('NotStarted', 'InProgress', 'Completed', 'Exempted', 'Withdrawn', 'Halted'));
ALTER TABLE enrollments ADD CONSTRAINT "ck_enrollments_deadline" CHECK ( ("enrollment_type" = 'Required' AND "assigned_at" IS NOT NULL AND "expected_completion_days" IS NOT NULL AND "base_due_at" IS NOT NULL AND "due_at" IS NOT NULL) OR ("enrollment_type" = 'Optional' AND "assigned_at" IS NULL AND "expected_completion_days" IS NULL AND "base_due_at" IS NULL AND "due_at" IS NULL AND "extension_seconds" = 0) );
ALTER TABLE enrollments ADD CONSTRAINT "ck_enrollments_days" CHECK ("expected_completion_days" BETWEEN 1 AND 365);
ALTER TABLE enrollments ADD CONSTRAINT "ck_enrollments_due" CHECK ("extension_seconds" >= 0 AND "due_at" >= "base_due_at");
ALTER TABLE enrollments ADD CONSTRAINT "ck_enrollments_video_pct" CHECK ("video_completion_percent" BETWEEN 1 AND 100);
ALTER TABLE enrollments ADD CONSTRAINT "ck_enrollments_activity" CHECK ( ("status" <> 'NotStarted' OR "first_activity_at" IS NULL) AND ("status" <> 'InProgress' OR "first_activity_at" IS NOT NULL) );
ALTER TABLE enrollments ADD CONSTRAINT "ck_enrollments_completed" CHECK (("status" = 'Completed') = ("completed_at" IS NOT NULL));
ALTER TABLE enrollments ADD CONSTRAINT "ck_enrollments_late" CHECK (("completed_late" IS NOT NULL) = ("status" = 'Completed' AND "enrollment_type" = 'Required'));
ALTER TABLE enrollments ADD CONSTRAINT "ck_enrollments_exempted" CHECK ("status" <> 'Exempted' OR "enrollment_type" = 'Required');
ALTER TABLE enrollments ADD CONSTRAINT enrollments_due_timezone_check CHECK ((due_at IS NULL) = (due_timezone IS NULL));
ALTER TABLE enrollments ADD CONSTRAINT ck_enrollments_withdrawn CHECK ( (status = 'Withdrawn') = (withdrawn_at IS NOT NULL) AND (status = 'Withdrawn') = (withdrawn_reason IS NOT NULL) AND (withdrawn_reason IS NULL OR withdrawn_reason IN ('LearnerWithdrew', 'AccountDeleted', 'HaltedClosed', 'OrganizerCancelled')) );
CREATE UNIQUE INDEX "enrollments_learner_id_course_id_key" ON "enrollments"("learner_id", "course_id");
CREATE INDEX "enrollments_course_id_status_idx" ON "enrollments"("course_id", "status");
CREATE INDEX "enrollments_organization_id_enrollment_type_status_idx" ON "enrollments"("organization_id", "enrollment_type", "status");
CREATE UNIQUE INDEX "enrollments_id_organization_id_key" ON "enrollments"("id", "organization_id");
CREATE INDEX "enrollments_organization_id_due_at_required_idx" ON "enrollments" ("organization_id", "due_at") WHERE "enrollment_type" = 'Required';
CREATE INDEX "ix_enrollments_org_period" ON "enrollments" ("organization_id", (COALESCE("assigned_at", "enrolled_at")));
CREATE INDEX ix_enrollments_uc24_order ON enrollments ( organization_id, (CASE WHEN status = 'Completed' THEN 1 ELSE 0 END), (CASE WHEN status <> 'Completed' THEN due_at END) ASC, (CASE WHEN status = 'Completed' THEN completed_at END) DESC, id DESC ) WHERE enrollment_type = 'Required';
```

### `enrollment_status_intervals`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `enrollment_id` | `UUID NOT NULL` |
| `kind` | `TEXT NOT NULL` |
| `started_at` | `TIMESTAMPTZ NOT NULL` |
| `ended_at` | `TIMESTAMPTZ` |
| `reason` | `VARCHAR(1000)` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

```sql
ALTER TABLE enrollment_status_intervals ADD CONSTRAINT "enrollment_status_intervals_pkey" PRIMARY KEY ("id");
ALTER TABLE enrollment_status_intervals ADD CONSTRAINT "enrollment_status_intervals_enrollment_id_organization_id_fkey" FOREIGN KEY ("enrollment_id", "organization_id") REFERENCES "enrollments"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE enrollment_status_intervals ADD CONSTRAINT "ck_intervals_kind" CHECK ("kind" IN ('Exempted', 'Halted'));
ALTER TABLE enrollment_status_intervals ADD CONSTRAINT "ck_intervals_range" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at");
ALTER TABLE enrollment_status_intervals ADD CONSTRAINT "ck_intervals_reason" CHECK ( (kind = 'Exempted' AND reason IS NOT NULL AND length(btrim(reason)) > 0) OR (kind = 'Halted' AND reason IS NULL) );
CREATE UNIQUE INDEX "enrollment_status_intervals_enrollment_id_kind_started_at_key" ON "enrollment_status_intervals"("enrollment_id", "kind", "started_at");
CREATE UNIQUE INDEX "enrollment_status_intervals_open_key" ON "enrollment_status_intervals" ("enrollment_id") WHERE "ended_at" IS NULL;
```

### `material_progress`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `enrollment_id` | `UUID NOT NULL` |
| `material_id` | `UUID NOT NULL` |
| `watched_ranges` | `int4multirange` |
| `completed_at` | `TIMESTAMPTZ` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `last_reported_at` | `TIMESTAMPTZ` |
| `position_seconds` | `INTEGER` |
| `position_reported_at` | `TIMESTAMPTZ` |

```sql
ALTER TABLE material_progress ADD CONSTRAINT "material_progress_pkey" PRIMARY KEY ("id");
ALTER TABLE material_progress ADD CONSTRAINT "material_progress_enrollment_id_organization_id_fkey" FOREIGN KEY ("enrollment_id", "organization_id") REFERENCES "enrollments"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE material_progress ADD CONSTRAINT "material_progress_material_id_organization_id_fkey" FOREIGN KEY ("material_id", "organization_id") REFERENCES "material_snapshots"("material_id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE material_progress ADD CONSTRAINT "ck_progress_not_empty" CHECK ("watched_ranges" IS NOT NULL OR "completed_at" IS NOT NULL);
ALTER TABLE material_progress ADD CONSTRAINT "ck_progress_ranges_lower" CHECK ("watched_ranges" IS NULL OR isempty("watched_ranges") OR (NOT lower_inf("watched_ranges") AND NOT upper_inf("watched_ranges") AND lower("watched_ranges") >= 0));
ALTER TABLE material_progress ADD CONSTRAINT "ck_progress_position_nonnegative" CHECK ("position_seconds" IS NULL OR "position_seconds" >= 0);
CREATE UNIQUE INDEX "material_progress_enrollment_id_material_id_key" ON "material_progress"("enrollment_id", "material_id");
CREATE INDEX "material_progress_material_id_completed_idx" ON "material_progress" ("material_id") WHERE "completed_at" IS NOT NULL;
```

### `course_version_snapshots`

| Column | PostgreSQL definition |
| --- | --- |
| `course_id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `chain_id` | `UUID NOT NULL` |
| `tree_fetched_at` | `TIMESTAMPTZ NOT NULL` |
| `disabled_at` | `TIMESTAMPTZ` |
| `disabled_as_of` | `TIMESTAMPTZ NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

```sql
ALTER TABLE course_version_snapshots ADD CONSTRAINT "course_version_snapshots_pkey" PRIMARY KEY ("course_id");
CREATE UNIQUE INDEX "course_version_snapshots_course_id_organization_id_key" ON "course_version_snapshots"("course_id", "organization_id");
```

### `material_snapshots`

| Column | PostgreSQL definition |
| --- | --- |
| `material_id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `course_id` | `UUID NOT NULL` |
| `lesson_id` | `UUID NOT NULL` |
| `material_type` | `TEXT NOT NULL` |
| `is_required` | `BOOLEAN NOT NULL` |
| `duration_seconds` | `INTEGER` |
| `duration_as_of` | `TIMESTAMPTZ` |
| `disabled_at` | `TIMESTAMPTZ` |
| `disabled_as_of` | `TIMESTAMPTZ NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

```sql
ALTER TABLE material_snapshots ADD CONSTRAINT "material_snapshots_pkey" PRIMARY KEY ("material_id");
ALTER TABLE material_snapshots ADD CONSTRAINT "material_snapshots_course_id_organization_id_fkey" FOREIGN KEY ("course_id", "organization_id") REFERENCES "course_version_snapshots"("course_id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE material_snapshots ADD CONSTRAINT "ck_material_snapshots_type" CHECK ("material_type" IN ('Video', 'Reading'));
ALTER TABLE material_snapshots ADD CONSTRAINT "ck_material_snapshots_video_duration" CHECK (("material_type" = 'Video') = ("duration_seconds" IS NOT NULL AND "duration_as_of" IS NOT NULL));
ALTER TABLE material_snapshots ADD CONSTRAINT "ck_material_snapshots_duration_positive" CHECK ("duration_seconds" > 0);
CREATE INDEX "material_snapshots_course_id_lesson_id_idx" ON "material_snapshots"("course_id", "lesson_id");
CREATE UNIQUE INDEX "material_snapshots_material_id_organization_id_key" ON "material_snapshots"("material_id", "organization_id");
```

### `lesson_snapshots`

| Column | PostgreSQL definition |
| --- | --- |
| `lesson_id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `course_id` | `UUID NOT NULL` |
| `disabled_at` | `TIMESTAMPTZ` |
| `disabled_as_of` | `TIMESTAMPTZ NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

```sql
ALTER TABLE lesson_snapshots ADD CONSTRAINT "lesson_snapshots_pkey" PRIMARY KEY ("lesson_id");
ALTER TABLE lesson_snapshots ADD CONSTRAINT "lesson_snapshots_course_id_organization_id_fkey" FOREIGN KEY ("course_id", "organization_id") REFERENCES "course_version_snapshots"("course_id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "lesson_snapshots_organization_id_course_id_idx" ON "lesson_snapshots"("organization_id", "course_id");
```

### `organization_suspensions`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `started_at` | `TIMESTAMPTZ NOT NULL` |
| `ended_at` | `TIMESTAMPTZ` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

```sql
ALTER TABLE organization_suspensions ADD CONSTRAINT "organization_suspensions_pkey" PRIMARY KEY ("id");
ALTER TABLE organization_suspensions ADD CONSTRAINT "ck_organization_suspensions_range" CHECK ("ended_at" > "started_at");
CREATE INDEX "organization_suspensions_organization_id_started_at_idx" ON "organization_suspensions"("organization_id", "started_at");
CREATE UNIQUE INDEX "organization_suspensions_open_key" ON "organization_suspensions" ("organization_id") WHERE "ended_at" IS NULL;
```

### `learner_accounts`

| Column | PostgreSQL definition |
| --- | --- |
| `user_id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `deactivated_at` | `TIMESTAMPTZ` |
| `deleted_at` | `TIMESTAMPTZ` |
| `status_as_of` | `TIMESTAMPTZ NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

```sql
ALTER TABLE learner_accounts ADD CONSTRAINT "learner_accounts_pkey" PRIMARY KEY ("user_id");
```

### `platform_settings`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `video_completion_percent` | `INTEGER NOT NULL` |
| `source_as_of` | `TIMESTAMPTZ NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

```sql
ALTER TABLE platform_settings ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");
ALTER TABLE platform_settings ADD CONSTRAINT "ck_platform_settings_video_pct" CHECK ("video_completion_percent" BETWEEN 1 AND 100);
CREATE UNIQUE INDEX "platform_settings_single_row_key" ON "platform_settings" ((true));
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
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `attempts` | `integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)` |
| `last_error` | `text` |
| `next_attempt_at` | `timestamptz` |

```sql
ALTER TABLE outbox_events ADD CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id");
CREATE INDEX "outbox_events_unpublished_idx" ON "outbox_events" ("id") WHERE "published_at" IS NULL;
CREATE INDEX outbox_events_unpublished_aggregate_id_idx ON outbox_events (aggregate_id, id) WHERE published_at IS NULL;
```

### `completion_evaluation_requests`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `uuid PRIMARY KEY` |
| `organization_id` | `uuid NOT NULL` |
| `enrollment_id` | `uuid NOT NULL UNIQUE` |
| `source` | `text NOT NULL CHECK (source IN ('VIDEO_COMPLETED','ASSIGNMENT_CONVERT','ASSIGNMENT_RESTORE','OPTIONAL_RESTORE'))` |
| `requested_at` | `timestamptz NOT NULL DEFAULT now()` |
| `attempts` | `bigint NOT NULL DEFAULT 0 CHECK (attempts >= 0)` |
| `generation` | `bigint NOT NULL DEFAULT 0 CHECK (generation >= 0)` |
| `next_attempt_at` | `timestamptz NOT NULL DEFAULT now()` |
| `last_error` | `text CHECK (last_error IS NULL OR last_error IN ('ASSESSMENT_UNAVAILABLE','INVALID_SNAPSHOT','COMPLETION_TRANSACTION_FAILED','LEASED'))` |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` |

```sql
ALTER TABLE completion_evaluation_requests ADD FOREIGN KEY (enrollment_id, organization_id) REFERENCES enrollments(id, organization_id) ON DELETE CASCADE;
ALTER TABLE completion_evaluation_requests ADD CONSTRAINT completion_evaluation_requests_source_check CHECK (source IN ('VIDEO_COMPLETED','READING_COMPLETED','ASSIGNMENT_CONVERT','ASSIGNMENT_RESTORE','OPTIONAL_RESTORE','assessment'));
CREATE INDEX completion_evaluation_requests_due_idx ON completion_evaluation_requests(next_attempt_at, id);
```

### `assessment_event_quarantine`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `uuid PRIMARY KEY` |
| `topic` | `text NOT NULL` |
| `partition` | `integer NOT NULL` |
| `offset` | `bigint NOT NULL` |
| `event_id` | `text` |
| `reason` | `varchar(64) NOT NULL` |
| `payload` | `jsonb NOT NULL` |
| `received_at` | `timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP` |

```sql
ALTER TABLE assessment_event_quarantine ADD CONSTRAINT assessment_event_quarantine_topic_partition_offset_key UNIQUE(topic, partition, "offset");
```

## Provided to other services

- The [Learning API](../../contracts/openapi/learning-service.yaml) covers enrollment history, assessment access and learner enrollment queries.
- Course can query [counts by version](../../services/learning-service/src/modules/enrollments/enrollments.controller.ts) and [lesson completion](../../services/learning-service/src/modules/curriculum/curriculum.controller.ts).
- Learning publishes completion and learner lifecycle events on the [shared enrollment stream](../../contracts/events/learning-enrollment-events.md).

## Business rule numbering

Crosswalk retained on 2026-11-17 because source comments still cite the old numbers.

| Current | Old | Rule |
| --- | --- | --- |
| BR-167 | BR-300 | Base due date in the organization timezone |
| BR-161 | BR-305 | Restore progress for the same version |
| BR-186 | BR-306 | Complete a lesson with no required materials when all its materials are complete |
