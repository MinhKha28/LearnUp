-- AlterTable
ALTER TABLE "media_files" ADD COLUMN     "delivery_type" TEXT NOT NULL DEFAULT 'upload',
ADD COLUMN     "storage_format" TEXT NOT NULL DEFAULT '';
