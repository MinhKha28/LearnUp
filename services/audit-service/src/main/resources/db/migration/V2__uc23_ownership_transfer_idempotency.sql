-- UC23: Kafka re-delivery must not duplicate ownership transfer Audit records.
CREATE UNIQUE INDEX uq_audit_uc23_transfer_event
ON audit_logs(action_type, correlation_id)
WHERE action_type = 'COURSE_OWNERSHIP_TRANSFERRED'
  AND correlation_id IS NOT NULL;
