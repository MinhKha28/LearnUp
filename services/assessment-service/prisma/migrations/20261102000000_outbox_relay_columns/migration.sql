-- The relay that publishes outbox events (step 22): how many times a row failed, the code of the last failure and when
-- it may be tried again. Rows written before this migration start at 0 and are tried at once.
ALTER TABLE "outbox_events"
    ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "last_error" TEXT,
    ADD COLUMN "next_attempt_at" TIMESTAMPTZ;
