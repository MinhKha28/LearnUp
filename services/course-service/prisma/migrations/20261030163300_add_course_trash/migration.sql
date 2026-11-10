-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "deleted_at" TIMESTAMPTZ,
ADD COLUMN     "deleted_by" UUID;

-- CreateIndex
CREATE INDEX "courses_organization_id_deleted_at_idx" ON "courses"("organization_id", "deleted_at");
