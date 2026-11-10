-- BR-269: retain the validated completion snapshot; legacy Completed rows remain NULL.
ALTER TABLE enrollments ADD COLUMN completion_snapshot jsonb;

CREATE TABLE completion_evaluation_requests (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  enrollment_id uuid NOT NULL UNIQUE,
  source text NOT NULL CHECK (source IN ('VIDEO_COMPLETED','ASSIGNMENT_CONVERT','ASSIGNMENT_RESTORE','OPTIONAL_RESTORE')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  attempts bigint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  generation bigint NOT NULL DEFAULT 0 CHECK (generation >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  -- Fixed diagnostic codes only; text has no arbitrary truncation limit or personal data.
  last_error text CHECK (last_error IS NULL OR last_error IN ('ASSESSMENT_UNAVAILABLE','INVALID_SNAPSHOT','COMPLETION_TRANSACTION_FAILED','LEASED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (enrollment_id, organization_id) REFERENCES enrollments(id, organization_id) ON DELETE CASCADE
);
-- Supports bounded polling ordered by eligibility time; material indexes await EXPLAIN evidence.
CREATE INDEX completion_evaluation_requests_due_idx ON completion_evaluation_requests(next_attempt_at, id);
