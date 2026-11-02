-- AlterTable
ALTER TABLE "outbox_events" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "next_attempt_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_id_id_idx" ON "outbox_events"("aggregate_id", "id");
