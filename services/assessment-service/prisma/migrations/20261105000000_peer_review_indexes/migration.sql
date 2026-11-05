-- The queries of peer review that read by cycle or by submission (the detail of a cycle, the closing, the reviews of a
-- submission when one is given, the schedule) scanned the whole table. EXPLAIN (ANALYZE) on 20 000 cycles, 400 000
-- submissions and 800 000 reviews: 15-110 ms before, under 0.5 ms after.
--
-- CREATE INDEX takes a lock that stops writes to the table while it builds. The tables are small today and a build takes
-- seconds; on a table with a lot of rows, build them first by hand with CREATE INDEX CONCURRENTLY (the same names), then
-- run this migration (IF NOT EXISTS leaves them alone).
CREATE INDEX IF NOT EXISTS "submission_reviews_submission_id_idx" ON "submission_reviews"("submission_id");
CREATE INDEX IF NOT EXISTS "submission_reviews_cycle_id_status_idx" ON "submission_reviews"("cycle_id", "status");
CREATE INDEX IF NOT EXISTS "submissions_cycle_id_idx" ON "submissions"("cycle_id");
