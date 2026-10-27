ALTER TABLE outbox_events
  ADD COLUMN attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  ADD COLUMN last_error text,
  ADD COLUMN next_attempt_at timestamptz;
CREATE INDEX outbox_events_unpublished_aggregate_id_idx
  ON outbox_events (aggregate_id, id) WHERE published_at IS NULL;
