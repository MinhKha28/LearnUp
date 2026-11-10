-- D-051/D-052: local Tenant timezone preflight is an operator prerequisite.
-- Existing deadlines were established in Asia/Ho_Chi_Minh; do not call Tenant here.
BEGIN;
ALTER TABLE enrollments ADD COLUMN due_timezone TEXT;
UPDATE enrollments SET due_timezone = 'Asia/Ho_Chi_Minh' WHERE due_at IS NOT NULL;
ALTER TABLE enrollments ADD CONSTRAINT enrollments_due_timezone_check
  CHECK ((due_at IS NULL) = (due_timezone IS NULL));
COMMIT;
