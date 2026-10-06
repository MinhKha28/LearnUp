-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "email_verification_code_ttl_minutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "max_verification_code_attempts" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "email_verified_at" TIMESTAMPTZ,
ADD COLUMN     "verification_code_expires_at" TIMESTAMPTZ,
ADD COLUMN     "verification_code_hash" BYTEA,
ADD COLUMN     "verification_failed_attempts" INTEGER NOT NULL DEFAULT 0;
