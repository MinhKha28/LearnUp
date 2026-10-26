-- AlterTable
ALTER TABLE "outbox_events" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failed_at" TIMESTAMPTZ,
ADD COLUMN     "last_error_code" TEXT,
ADD COLUMN     "next_attempt_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "outbox_events_pending_claim_idx" ON "outbox_events"("event_type", "id") WHERE (published_at IS NULL AND failed_at IS NULL);

