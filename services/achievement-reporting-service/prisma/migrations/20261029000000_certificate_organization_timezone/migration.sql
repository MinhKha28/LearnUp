-- D-053: freeze the Organization timezone when issuing a Certificate.
BEGIN;
ALTER TABLE certificates ADD COLUMN organization_timezone TEXT;

-- Preserve the historical display default for already Issued certificates.
-- The table lock and transaction prevent concurrent writes while the guard is disabled.
ALTER TABLE certificates DISABLE TRIGGER trg_certificates_guard;
UPDATE certificates SET organization_timezone='Asia/Ho_Chi_Minh'
WHERE status='Issued' AND organization_timezone IS NULL;
ALTER TABLE certificates ENABLE TRIGGER trg_certificates_guard;

ALTER TABLE certificates ADD CONSTRAINT ck_certificates_organization_timezone CHECK (
  (status='Pending' AND organization_timezone IS NULL) OR
  (status='Issued' AND organization_timezone IS NOT NULL AND btrim(organization_timezone)<>''));
COMMIT;
