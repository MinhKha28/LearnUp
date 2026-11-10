CREATE TABLE certificate_signer_settings (
 organization_id UUID PRIMARY KEY,
 signer_name VARCHAR(100) NOT NULL CHECK (btrim(signer_name)<>''),
 signer_title VARCHAR(200) NOT NULL CHECK (btrim(signer_title)<>''),
 signature_asset_key TEXT,
 signature_hash VARCHAR(64),
 signature_mime TEXT,
 signature_size_bytes INTEGER,
 version INTEGER NOT NULL CHECK (version>=1),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_by UUID NOT NULL,
 CONSTRAINT ck_signer_settings_signature CHECK (
  (signature_asset_key IS NULL AND signature_hash IS NULL AND signature_mime IS NULL AND signature_size_bytes IS NULL) OR
  (signature_asset_key IS NOT NULL AND signature_asset_key<>'' AND signature_hash IS NOT NULL AND signature_hash ~ '^[0-9a-f]{64}$'
   AND signature_mime IS NOT NULL AND signature_mime IN ('image/png','image/jpeg') AND signature_size_bytes IS NOT NULL AND signature_size_bytes>0 AND signature_size_bytes<=2097152))
);
ALTER TABLE certificates DROP CONSTRAINT ck_certificates_signature;
ALTER TABLE certificates ADD CONSTRAINT ck_certificates_signature CHECK (
 (signature_asset_key IS NULL AND signature_hash IS NULL AND signature_mime IS NULL) OR
 (signature_asset_key IS NOT NULL AND signature_asset_key<>'' AND signature_hash IS NOT NULL AND signature_hash ~ '^[0-9a-f]{64}$'
 AND signature_mime IS NOT NULL AND signature_mime IN ('image/png','image/jpeg') AND signer_name IS NOT NULL AND signer_title IS NOT NULL));
CREATE TABLE storage_cleanup_tasks (
 id UUID PRIMARY KEY,
 asset_key TEXT NOT NULL UNIQUE CHECK (asset_key<>''),
 reason VARCHAR(80) NOT NULL,
 not_before TIMESTAMPTZ NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts>=0),
 last_error VARCHAR(80),
 next_attempt_at TIMESTAMPTZ NOT NULL,
 lease_token UUID,
 lease_until TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT ck_cleanup_lease CHECK ((lease_token IS NULL AND lease_until IS NULL) OR (lease_token IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX ix_storage_cleanup_due ON storage_cleanup_tasks(next_attempt_at,not_before);
