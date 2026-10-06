-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "email_otp_max_failed_attempts" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "email_otp_ttl_minutes" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "email_verified_at" TIMESTAMPTZ,
ADD COLUMN     "otp_expires_at" TIMESTAMPTZ,
ADD COLUMN     "otp_failed_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otp_hash" BYTEA;
