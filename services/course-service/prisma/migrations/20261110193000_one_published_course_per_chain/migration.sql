-- UC21.3 / BR-134: a Course Chain may expose at most one active Published version.
-- A soft-deleted row does not participate in the active lifecycle.
-- Fail clearly if legacy data is inconsistent; do not silently archive existing Courses.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM courses
    WHERE status = 'Published' AND deleted_at IS NULL
    GROUP BY chain_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'UC21.3 migration aborted: multiple active Published Courses in one Chain';
  END IF;
END
$$;

CREATE UNIQUE INDEX "uq_courses_one_active_published_per_chain"
  ON "courses" ("chain_id")
  WHERE "status" = 'Published' AND "deleted_at" IS NULL;
