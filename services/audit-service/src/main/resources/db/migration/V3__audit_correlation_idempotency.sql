-- General idempotency for asynchronous Audit writers (Tenant, Course, future services).
-- Correlation IDs may be reused for different action types, so scope the key
-- to (action_type, correlation_id). Migration intentionally fails on existing
-- duplicates: inspect and reconcile duplicates before applying.
CREATE UNIQUE INDEX uq_audit_action_correlation
ON audit_logs(action_type, correlation_id)
WHERE correlation_id IS NOT NULL;

-- The previous UC23-only index is now redundant.
DROP INDEX IF EXISTS uq_audit_uc23_transfer_event;
