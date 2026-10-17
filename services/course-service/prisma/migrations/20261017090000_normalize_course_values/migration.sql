BEGIN;

LOCK TABLE courses IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM courses
    WHERE status NOT IN (
      'DRAFT', 'SUBMITTED', 'PUBLISHED', 'REJECTED', 'ARCHIVED', 'DISABLED',
      'Draft', 'Submitted', 'Published', 'Rejected', 'Archived', 'Disabled'
    ) OR course_type NOT IN ('PUBLIC', 'PRIVATE', 'Public', 'Private')
  ) THEN
    RAISE EXCEPTION 'Unknown Course status or course_type; normalization aborted';
  END IF;
END $$;

UPDATE courses
SET status = CASE status
    WHEN 'DRAFT' THEN 'Draft'
    WHEN 'SUBMITTED' THEN 'Submitted'
    WHEN 'PUBLISHED' THEN 'Published'
    WHEN 'REJECTED' THEN 'Rejected'
    WHEN 'ARCHIVED' THEN 'Archived'
    WHEN 'DISABLED' THEN 'Disabled'
    ELSE status
  END,
  course_type = CASE course_type
    WHEN 'PUBLIC' THEN 'Public'
    WHEN 'PRIVATE' THEN 'Private'
    ELSE course_type
  END
WHERE status IN ('DRAFT', 'SUBMITTED', 'PUBLISHED', 'REJECTED', 'ARCHIVED', 'DISABLED')
   OR course_type IN ('PUBLIC', 'PRIVATE');

ALTER TABLE courses
  ADD CONSTRAINT ck_courses_status
    CHECK (status IN ('Draft', 'Submitted', 'Published', 'Rejected', 'Archived', 'Disabled')),
  ADD CONSTRAINT ck_courses_course_type
    CHECK (course_type IN ('Public', 'Private'));

COMMIT;
