ALTER TABLE completion_evaluation_requests
  DROP CONSTRAINT completion_evaluation_requests_source_check;
ALTER TABLE completion_evaluation_requests
  ADD CONSTRAINT completion_evaluation_requests_source_check
  CHECK (source IN ('VIDEO_COMPLETED','READING_COMPLETED','ASSIGNMENT_CONVERT','ASSIGNMENT_RESTORE','OPTIONAL_RESTORE','assessment'));

CREATE TABLE assessment_event_quarantine (
  id uuid PRIMARY KEY,
  topic text NOT NULL,
  partition integer NOT NULL,
  "offset" bigint NOT NULL,
  event_id text,
  reason varchar(64) NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT assessment_event_quarantine_topic_partition_offset_key UNIQUE(topic, partition, "offset")
);
