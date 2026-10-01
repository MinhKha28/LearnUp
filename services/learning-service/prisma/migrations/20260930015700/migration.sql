-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "enrollment_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "enrolled_at" TIMESTAMPTZ NOT NULL,
    "assigned_at" TIMESTAMPTZ,
    "expected_completion_days" INTEGER,
    "base_due_at" TIMESTAMPTZ,
    "extension_seconds" BIGINT NOT NULL DEFAULT 0,
    "due_at" TIMESTAMPTZ,
    "video_completion_percent" INTEGER NOT NULL,
    "first_activity_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "completed_late" BOOLEAN,
    "withdrawn_at" TIMESTAMPTZ,
    "withdrawn_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_status_intervals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "ended_at" TIMESTAMPTZ,
    "reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "enrollment_status_intervals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_progress" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "watched_ranges" int4multirange,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "material_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_version_snapshots" (
    "course_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "chain_id" UUID NOT NULL,
    "tree_fetched_at" TIMESTAMPTZ NOT NULL,
    "disabled_at" TIMESTAMPTZ,
    "disabled_as_of" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "course_version_snapshots_pkey" PRIMARY KEY ("course_id")
);

-- CreateTable
CREATE TABLE "material_snapshots" (
    "material_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "material_type" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL,
    "duration_seconds" INTEGER,
    "duration_as_of" TIMESTAMPTZ,
    "disabled_at" TIMESTAMPTZ,
    "disabled_as_of" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "material_snapshots_pkey" PRIMARY KEY ("material_id")
);

-- CreateTable
CREATE TABLE "lesson_snapshots" (
    "lesson_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "disabled_at" TIMESTAMPTZ,
    "disabled_as_of" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lesson_snapshots_pkey" PRIMARY KEY ("lesson_id")
);

-- CreateTable
CREATE TABLE "organization_suspensions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "ended_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organization_suspensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_accounts" (
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "deactivated_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "status_as_of" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "learner_accounts_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" UUID NOT NULL,
    "video_completion_percent" INTEGER NOT NULL DEFAULT 90,
    "source_as_of" TIMESTAMPTZ NOT NULL,
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
CREATE INDEX "enrollments_organization_id_status_idx" ON "enrollments"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_learner_id_course_id_key" ON "enrollments"("learner_id", "course_id");

-- CreateIndex
CREATE INDEX "enrollment_status_intervals_organization_id_enrollment_id_idx" ON "enrollment_status_intervals"("organization_id", "enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_progress_enrollment_id_material_id_key" ON "material_progress"("enrollment_id", "material_id");

-- CreateIndex
CREATE INDEX "material_snapshots_organization_id_course_id_idx" ON "material_snapshots"("organization_id", "course_id");

-- CreateIndex
CREATE INDEX "lesson_snapshots_organization_id_course_id_idx" ON "lesson_snapshots"("organization_id", "course_id");

-- CreateIndex
CREATE INDEX "organization_suspensions_organization_id_idx" ON "organization_suspensions"("organization_id");

-- CreateIndex
CREATE INDEX "learner_accounts_organization_id_idx" ON "learner_accounts"("organization_id");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_idx" ON "outbox_events"("published_at");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course_version_snapshots"("course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_status_intervals" ADD CONSTRAINT "enrollment_status_intervals_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_progress" ADD CONSTRAINT "material_progress_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_progress" ADD CONSTRAINT "material_progress_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material_snapshots"("material_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_snapshots" ADD CONSTRAINT "material_snapshots_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course_version_snapshots"("course_id") ON DELETE RESTRICT ON UPDATE CASCADE;
