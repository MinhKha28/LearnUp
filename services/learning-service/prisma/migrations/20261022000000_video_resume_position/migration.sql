ALTER TABLE "material_progress"
  ADD COLUMN "position_seconds" INTEGER,
  ADD COLUMN "position_reported_at" TIMESTAMPTZ;

ALTER TABLE "material_progress"
  ADD CONSTRAINT "ck_progress_position_nonnegative"
  CHECK ("position_seconds" IS NULL OR "position_seconds" >= 0);
