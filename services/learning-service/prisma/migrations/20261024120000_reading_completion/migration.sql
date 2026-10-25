ALTER TABLE completion_evaluation_requests
  DROP CONSTRAINT completion_evaluation_requests_source_check;
ALTER TABLE completion_evaluation_requests
  ADD CONSTRAINT completion_evaluation_requests_source_check
  CHECK (source IN ('VIDEO_COMPLETED','READING_COMPLETED','ASSIGNMENT_CONVERT','ASSIGNMENT_RESTORE','OPTIONAL_RESTORE'));
