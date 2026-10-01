-- DropForeignKey
ALTER TABLE "enrollment_status_intervals" DROP CONSTRAINT "enrollment_status_intervals_enrollment_id_fkey";

-- DropForeignKey
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_course_id_fkey";

-- DropForeignKey
ALTER TABLE "material_progress" DROP CONSTRAINT "material_progress_enrollment_id_fkey";

-- DropForeignKey
ALTER TABLE "material_progress" DROP CONSTRAINT "material_progress_material_id_fkey";

-- DropForeignKey
ALTER TABLE "material_snapshots" DROP CONSTRAINT "material_snapshots_course_id_fkey";

-- DropIndex
DROP INDEX "enrollment_status_intervals_organization_id_enrollment_id_idx";

-- DropIndex
DROP INDEX "enrollments_organization_id_status_idx";

-- DropIndex
DROP INDEX "learner_accounts_organization_id_idx";

-- DropIndex
DROP INDEX "material_snapshots_organization_id_course_id_idx";

-- DropIndex
DROP INDEX "organization_suspensions_organization_id_idx";

-- DropIndex
DROP INDEX "outbox_events_published_at_idx";

-- AlterTable
ALTER TABLE "course_version_snapshots" ALTER COLUMN "disabled_as_of" SET NOT NULL,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "enrollment_status_intervals" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "enrollments" ALTER COLUMN "status" SET DEFAULT 'NotStarted',
ALTER COLUMN "enrolled_at" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "learner_accounts" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "lesson_snapshots" ALTER COLUMN "disabled_as_of" SET NOT NULL,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "material_progress" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "material_snapshots" ALTER COLUMN "disabled_as_of" SET NOT NULL,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "organization_suspensions" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "outbox_events" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "platform_settings" ALTER COLUMN "video_completion_percent" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "course_version_snapshots_course_id_organization_id_key" ON "course_version_snapshots"("course_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_status_intervals_enrollment_id_kind_started_at_key" ON "enrollment_status_intervals"("enrollment_id", "kind", "started_at");

-- CreateIndex
CREATE INDEX "enrollments_course_id_status_idx" ON "enrollments"("course_id", "status");

-- CreateIndex
CREATE INDEX "enrollments_organization_id_enrollment_type_status_idx" ON "enrollments"("organization_id", "enrollment_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_id_organization_id_key" ON "enrollments"("id", "organization_id");

-- CreateIndex
CREATE INDEX "material_snapshots_course_id_lesson_id_idx" ON "material_snapshots"("course_id", "lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_snapshots_material_id_organization_id_key" ON "material_snapshots"("material_id", "organization_id");

-- CreateIndex
CREATE INDEX "organization_suspensions_organization_id_started_at_idx" ON "organization_suspensions"("organization_id", "started_at");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_organization_id_fkey" FOREIGN KEY ("course_id", "organization_id") REFERENCES "course_version_snapshots"("course_id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_status_intervals" ADD CONSTRAINT "enrollment_status_intervals_enrollment_id_organization_id_fkey" FOREIGN KEY ("enrollment_id", "organization_id") REFERENCES "enrollments"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_progress" ADD CONSTRAINT "material_progress_enrollment_id_organization_id_fkey" FOREIGN KEY ("enrollment_id", "organization_id") REFERENCES "enrollments"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_progress" ADD CONSTRAINT "material_progress_material_id_organization_id_fkey" FOREIGN KEY ("material_id", "organization_id") REFERENCES "material_snapshots"("material_id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_snapshots" ADD CONSTRAINT "material_snapshots_course_id_organization_id_fkey" FOREIGN KEY ("course_id", "organization_id") REFERENCES "course_version_snapshots"("course_id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_snapshots" ADD CONSTRAINT "lesson_snapshots_course_id_organization_id_fkey" FOREIGN KEY ("course_id", "organization_id") REFERENCES "course_version_snapshots"("course_id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- SQL viết tay: phần Prisma schema không biểu diễn được
-- Nguồn: docs/database/LearningService_Database_Design.md mục 3
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3.1 enrollments
-- -----------------------------------------------------------------------------
ALTER TABLE "enrollments" ADD CONSTRAINT "ck_enrollments_type"
  CHECK ("enrollment_type" IN ('Required', 'Optional'));

ALTER TABLE "enrollments" ADD CONSTRAINT "ck_enrollments_status"
  CHECK ("status" IN ('NotStarted', 'InProgress', 'Completed', 'Exempted', 'Withdrawn', 'Halted'));

-- Required ⇒ đủ 4 cột hạn; Optional ⇒ cả 4 NULL và extension_seconds = 0 (BR-129, BR-136, BR-138)
ALTER TABLE "enrollments" ADD CONSTRAINT "ck_enrollments_deadline"
  CHECK (
    ("enrollment_type" = 'Required'
      AND "assigned_at" IS NOT NULL
      AND "expected_completion_days" IS NOT NULL
      AND "base_due_at" IS NOT NULL
      AND "due_at" IS NOT NULL)
    OR
    ("enrollment_type" = 'Optional'
      AND "assigned_at" IS NULL
      AND "expected_completion_days" IS NULL
      AND "base_due_at" IS NULL
      AND "due_at" IS NULL
      AND "extension_seconds" = 0)
  );

ALTER TABLE "enrollments" ADD CONSTRAINT "ck_enrollments_days"
  CHECK ("expected_completion_days" BETWEEN 1 AND 365);

-- BR-140
ALTER TABLE "enrollments" ADD CONSTRAINT "ck_enrollments_due"
  CHECK ("extension_seconds" >= 0 AND "due_at" >= "base_due_at");

ALTER TABLE "enrollments" ADD CONSTRAINT "ck_enrollments_video_pct"
  CHECK ("video_completion_percent" BETWEEN 1 AND 100);

-- NotStarted ⇒ first_activity_at NULL; InProgress ⇒ có (BR-307)
ALTER TABLE "enrollments" ADD CONSTRAINT "ck_enrollments_activity"
  CHECK (
    ("status" <> 'NotStarted' OR "first_activity_at" IS NULL)
    AND ("status" <> 'InProgress' OR "first_activity_at" IS NOT NULL)
  );

ALTER TABLE "enrollments" ADD CONSTRAINT "ck_enrollments_completed"
  CHECK (("status" = 'Completed') = ("completed_at" IS NOT NULL));

-- completed_late có giá trị ⇔ Completed và Required (BR-143)
ALTER TABLE "enrollments" ADD CONSTRAINT "ck_enrollments_late"
  CHECK (("completed_late" IS NOT NULL) = ("status" = 'Completed' AND "enrollment_type" = 'Required'));

-- Exempted ⇒ Required (BR-120, BR-122)
ALTER TABLE "enrollments" ADD CONSTRAINT "ck_enrollments_exempted"
  CHECK ("status" <> 'Exempted' OR "enrollment_type" = 'Required');

-- Withdrawn ⇔ có withdrawn_at ⇔ có withdrawn_reason (BR-132, BR-303, BR-304)
ALTER TABLE "enrollments" ADD CONSTRAINT "ck_enrollments_withdrawn"
  CHECK (
    ("status" = 'Withdrawn') = ("withdrawn_at" IS NOT NULL)
    AND ("status" = 'Withdrawn') = ("withdrawn_reason" IS NOT NULL)
    AND ("withdrawn_reason" IS NULL
      OR "withdrawn_reason" IN ('LearnerWithdrew', 'AccountDeleted', 'HaltedClosed'))
  );

-- UC24, UC24.7, Overdue (BR-142, BR-47)
CREATE INDEX "enrollments_organization_id_due_at_required_idx"
  ON "enrollments" ("organization_id", "due_at")
  WHERE "enrollment_type" = 'Required';

-- Bộ lọc khoảng thời gian của REST báo cáo; truy vấn phải viết đúng biểu thức này (BR-329)
CREATE INDEX "ix_enrollments_org_period"
  ON "enrollments" ("organization_id", (COALESCE("assigned_at", "enrolled_at")));

-- -----------------------------------------------------------------------------
-- 3.2 enrollment_status_intervals
-- -----------------------------------------------------------------------------
ALTER TABLE "enrollment_status_intervals" ADD CONSTRAINT "ck_intervals_kind"
  CHECK ("kind" IN ('Exempted', 'Halted'));

-- Lý do ⇔ Exempted (BR-271)
ALTER TABLE "enrollment_status_intervals" ADD CONSTRAINT "ck_intervals_reason"
  CHECK (("kind" = 'Exempted') = ("reason" IS NOT NULL));

ALTER TABLE "enrollment_status_intervals" ADD CONSTRAINT "ck_intervals_range"
  CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at");

-- Tối đa một khoảng đang mở mỗi Enrollment
CREATE UNIQUE INDEX "enrollment_status_intervals_open_key"
  ON "enrollment_status_intervals" ("enrollment_id")
  WHERE "ended_at" IS NULL;

-- -----------------------------------------------------------------------------
-- 3.3 material_progress
-- -----------------------------------------------------------------------------
ALTER TABLE "material_progress" ADD CONSTRAINT "ck_progress_not_empty"
  CHECK ("watched_ranges" IS NOT NULL OR "completed_at" IS NOT NULL);

-- Bỏ qua NULL và multirange rỗng; chặn khoảng không có cận dưới hoặc cận trên
ALTER TABLE "material_progress" ADD CONSTRAINT "ck_progress_ranges_lower"
  CHECK ("watched_ranges" IS NULL OR isempty("watched_ranges")
    OR (NOT lower_inf("watched_ranges") AND NOT upper_inf("watched_ranges") AND lower("watched_ranges") >= 0));

-- BR-95
CREATE INDEX "material_progress_material_id_completed_idx"
  ON "material_progress" ("material_id")
  WHERE "completed_at" IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3.5 material_snapshots (thiết kế không đặt tên CHECK; tên dưới đây tự đặt)
-- -----------------------------------------------------------------------------
ALTER TABLE "material_snapshots" ADD CONSTRAINT "ck_material_snapshots_type"
  CHECK ("material_type" IN ('Video', 'Reading'));

ALTER TABLE "material_snapshots" ADD CONSTRAINT "ck_material_snapshots_video_duration"
  CHECK (("material_type" = 'Video') = ("duration_seconds" IS NOT NULL AND "duration_as_of" IS NOT NULL));

ALTER TABLE "material_snapshots" ADD CONSTRAINT "ck_material_snapshots_duration_positive"
  CHECK ("duration_seconds" > 0);

-- -----------------------------------------------------------------------------
-- 3.7 organization_suspensions (thiết kế không đặt tên CHECK; tên dưới đây tự đặt)
-- -----------------------------------------------------------------------------
ALTER TABLE "organization_suspensions" ADD CONSTRAINT "ck_organization_suspensions_range"
  CHECK ("ended_at" > "started_at");

-- Tối đa một lần khóa đang mở mỗi tổ chức
CREATE UNIQUE INDEX "organization_suspensions_open_key"
  ON "organization_suspensions" ("organization_id")
  WHERE "ended_at" IS NULL;

-- -----------------------------------------------------------------------------
-- 3.9 platform_settings (thiết kế không đặt tên CHECK; tên dưới đây tự đặt)
-- -----------------------------------------------------------------------------
ALTER TABLE "platform_settings" ADD CONSTRAINT "ck_platform_settings_video_pct"
  CHECK ("video_completion_percent" BETWEEN 1 AND 100);

-- Bảng một dòng (quy ước mục 4)
CREATE UNIQUE INDEX "platform_settings_single_row_key"
  ON "platform_settings" ((true));

-- -----------------------------------------------------------------------------
-- 3.10 outbox_events: thay index (published_at) đã drop ở trên (quy ước mục 5)
-- -----------------------------------------------------------------------------
CREATE INDEX "outbox_events_unpublished_idx"
  ON "outbox_events" ("id")
  WHERE "published_at" IS NULL;
