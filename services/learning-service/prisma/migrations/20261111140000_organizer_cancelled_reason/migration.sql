ALTER TABLE enrollments DROP CONSTRAINT ck_enrollments_withdrawn;

ALTER TABLE enrollments ADD CONSTRAINT ck_enrollments_withdrawn
  CHECK (
    (status = 'Withdrawn') = (withdrawn_at IS NOT NULL)
    AND (status = 'Withdrawn') = (withdrawn_reason IS NOT NULL)
    AND (withdrawn_reason IS NULL OR withdrawn_reason IN
      ('LearnerWithdrew', 'AccountDeleted', 'HaltedClosed', 'OrganizerCancelled'))
  );
