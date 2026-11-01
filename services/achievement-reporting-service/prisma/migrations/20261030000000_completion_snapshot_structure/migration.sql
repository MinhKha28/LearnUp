ALTER TABLE certificates DROP CONSTRAINT ck_certificates_snapshot;
ALTER TABLE certificates ADD CONSTRAINT ck_certificates_snapshot CHECK (jsonb_typeof(score_snapshot)='object' AND score_snapshot @> '{"schemaVersion":1}'::jsonb AND jsonb_typeof(score_snapshot->'eligible') = 'boolean');
