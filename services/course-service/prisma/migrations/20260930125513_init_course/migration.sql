-- CreateTable
CREATE TABLE "organization_quota_locks" (
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organization_quota_locks_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "course_chains" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "course_chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "chain_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "short_description" VARCHAR(500),
    "training_objectives" VARCHAR(2000),
    "learning_outcomes" VARCHAR(200)[],
    "cover_file_id" UUID,
    "expected_completion_days" INTEGER NOT NULL,
    "course_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "locked_at" TIMESTAMPTZ,
    "submitted_at" TIMESTAMPTZ,
    "published_at" TIMESTAMPTZ,
    "archived_at" TIMESTAMPTZ,
    "rejected_at" TIMESTAMPTZ,
    "rejection_reason" VARCHAR(1000),
    "disabled_at" TIMESTAMPTZ,
    "disabled_reason" VARCHAR(1000),
    "assignment_minutes" INTEGER NOT NULL DEFAULT 0,
    "assignment_minutes_as_of" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" VARCHAR(20000) NOT NULL,
    "position" INTEGER NOT NULL,
    "disabled_at" TIMESTAMPTZ,
    "disabled_report_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "material_type" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "is_required" BOOLEAN NOT NULL,
    "file_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "disabled_at" TIMESTAMPTZ,
    "disabled_report_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_files" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(255) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "duration_seconds" INTEGER,
    "word_count" INTEGER,
    "ready_at" TIMESTAMPTZ,
    "released_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_reports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "owner_instructor_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "level" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "due_at" TIMESTAMPTZ NOT NULL,
    "org_decision" TEXT,
    "org_severity" TEXT,
    "org_decision_reason" VARCHAR(1000),
    "org_decided_by" UUID,
    "org_decided_at" TIMESTAMPTZ,
    "escalation_type" TEXT,
    "escalation_reason" VARCHAR(1000),
    "escalated_by" UUID,
    "escalated_at" TIMESTAMPTZ,
    "admin_decision" TEXT,
    "admin_severity" TEXT,
    "admin_decision_reason" VARCHAR(1000),
    "admin_decided_by" UUID,
    "admin_decided_at" TIMESTAMPTZ,
    "revision_requested_at" TIMESTAMPTZ,
    "review_requested_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" UUID NOT NULL,
    "source_as_of" TIMESTAMPTZ NOT NULL,
    "reading_speed_words_per_minute" INTEGER NOT NULL DEFAULT 200,
    "study_minutes_per_day" INTEGER NOT NULL DEFAULT 60,
    "duration_gap_threshold_percent" INTEGER NOT NULL DEFAULT 20,
    "max_video_size_bytes" BIGINT NOT NULL DEFAULT 2147483648,
    "max_video_duration_minutes" INTEGER NOT NULL DEFAULT 120,
    "max_reading_size_bytes" BIGINT NOT NULL DEFAULT 52428800,
    "allowed_video_mime_types" TEXT[] DEFAULT ARRAY['video/mp4']::TEXT[],
    "allowed_reading_mime_types" TEXT[] DEFAULT ARRAY['application/pdf']::TEXT[],
    "report_handling_days" INTEGER NOT NULL DEFAULT 7,
    "instructor_violation_threshold" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "organization_id" UUID,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_chains_organization_id_instructor_id_idx" ON "course_chains"("organization_id", "instructor_id");

-- CreateIndex
CREATE INDEX "courses_organization_id_status_idx" ON "courses"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "courses_chain_id_version_number_key" ON "courses"("chain_id", "version_number");

-- CreateIndex
CREATE INDEX "modules_organization_id_course_id_idx" ON "modules"("organization_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "modules_course_id_position_key" ON "modules"("course_id", "position");

-- CreateIndex
CREATE INDEX "lessons_organization_id_module_id_idx" ON "lessons"("organization_id", "module_id");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_module_id_position_key" ON "lessons"("module_id", "position");

-- CreateIndex
CREATE INDEX "materials_organization_id_file_id_idx" ON "materials"("organization_id", "file_id");

-- CreateIndex
CREATE UNIQUE INDEX "materials_lesson_id_position_key" ON "materials"("lesson_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "media_files_storage_key_key" ON "media_files"("storage_key");

-- CreateIndex
CREATE INDEX "media_files_organization_id_status_idx" ON "media_files"("organization_id", "status");

-- CreateIndex
CREATE INDEX "content_reports_organization_id_status_due_at_idx" ON "content_reports"("organization_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "content_reports_target_type_target_id_idx" ON "content_reports"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_idx" ON "outbox_events"("published_at");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "course_chains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_cover_file_id_fkey" FOREIGN KEY ("cover_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
