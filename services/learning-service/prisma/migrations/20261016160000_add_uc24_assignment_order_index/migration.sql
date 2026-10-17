CREATE INDEX ix_enrollments_uc24_order
ON enrollments (
  organization_id,
  (CASE WHEN status = 'Completed' THEN 1 ELSE 0 END),
  (CASE WHEN status <> 'Completed' THEN due_at END) ASC,
  (CASE WHEN status = 'Completed' THEN completed_at END) DESC,
  id DESC
)
WHERE enrollment_type = 'Required';
