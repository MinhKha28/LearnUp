# Achievement & Reporting database reference

Database `achievement_reporting_db`. See [conventions](conventions.md) and [Prisma schema and migrations](../../services/achievement-reporting-service/prisma/migrations).

[Mapped Prisma models](../../services/achievement-reporting-service/prisma/schema.prisma).

See the [completion snapshot constraint](../../services/achievement-reporting-service/prisma/migrations/20261030000000_completion_snapshot_structure/migration.sql).

## Invariants

- The enrollment and certificate code are unique. The Kafka receipt and Pending certificate are written together so redelivery does not create an additional certificate.
- The completion snapshot CHECK tests for a version 1 object and a boolean `eligible` value. The event consumer also validates the required fields. Issuance stores the event snapshot and uses `completedAt` for the issuance date.
- The certificate guard protects issued records and captured identity data from later changes.
- `evaluation_responses.id` uses UUID v4. The table omits creation and update timestamps so a response cannot be tied to a submission time through the ID or timestamp columns.

## Tables

### `certificates`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `enrollment_id` | `UUID NOT NULL` |
| `learner_id` | `UUID NOT NULL` |
| `course_id` | `UUID NOT NULL` |
| `certificate_code` | `VARCHAR(12) NOT NULL` |
| `status` | `TEXT NOT NULL DEFAULT 'Pending'` |
| `issued_at` | `TIMESTAMPTZ NOT NULL` |
| `completed_late` | `BOOLEAN NOT NULL` |
| `score_snapshot` | `JSONB NOT NULL` |
| `learner_name` | `VARCHAR(100)` |
| `course_name` | `VARCHAR(200)` |
| `version_number` | `INTEGER` |
| `chain_id` | `UUID` |
| `completion_fingerprint` | `VARCHAR(64) NOT NULL` |
| `organization_name` | `VARCHAR(200)` |
| `logo_asset_key` | `TEXT` |
| `logo_hash` | `VARCHAR(64)` |
| `logo_mime` | `TEXT` |
| `logo_size` | `INTEGER` |
| `signer_name` | `VARCHAR(100)` |
| `signer_title` | `VARCHAR(200)` |
| `signature_asset_key` | `TEXT` |
| `signature_hash` | `VARCHAR(64)` |
| `signature_mime` | `TEXT` |
| `issued_recorded_at` | `TIMESTAMPTZ` |
| `lease_token` | `UUID` |
| `lease_until` | `TIMESTAMPTZ` |
| `issue_attempts` | `INTEGER NOT NULL DEFAULT 0` |
| `next_attempt_at` | `TIMESTAMPTZ` |
| `last_error` | `TEXT` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |
| `organization_timezone` | `TEXT` |

```sql
ALTER TABLE certificates ADD CONSTRAINT "certificates_pkey" PRIMARY KEY ("id");
ALTER TABLE certificates ADD CONSTRAINT ck_certificates_status CHECK (status IN ('Pending','Issued'));
ALTER TABLE certificates ADD CONSTRAINT ck_certificates_code CHECK (certificate_code ~ '^[0-9A-HJKMNP-TV-Z]{12}$');
ALTER TABLE certificates ADD CONSTRAINT ck_certificates_fingerprint CHECK (completion_fingerprint ~ '^[0-9a-f]{64}$');
ALTER TABLE certificates ADD CONSTRAINT ck_certificates_attempts CHECK (issue_attempts>=0);
ALTER TABLE certificates ADD CONSTRAINT ck_certificates_lease CHECK ((lease_token IS NULL AND lease_until IS NULL) OR (lease_token IS NOT NULL AND lease_until IS NOT NULL));
ALTER TABLE certificates ADD CONSTRAINT ck_certificates_logo CHECK ( (logo_asset_key IS NULL AND logo_hash IS NULL AND logo_mime IS NULL AND logo_size IS NULL) OR (logo_asset_key IS NOT NULL AND logo_asset_key<>'' AND logo_hash IS NOT NULL AND logo_hash ~ '^[0-9a-f]{64}$' AND logo_mime IS NOT NULL AND logo_mime IN ('image/png','image/jpeg','image/webp') AND logo_size IS NOT NULL AND logo_size>0));
ALTER TABLE certificates ADD CONSTRAINT ck_certificates_signer CHECK ( (signer_name IS NULL AND signer_title IS NULL) OR (signer_name IS NOT NULL AND btrim(signer_name)<>'' AND signer_title IS NOT NULL AND btrim(signer_title)<>''));
ALTER TABLE certificates ADD CONSTRAINT ck_certificates_lifecycle CHECK ( (status='Pending' AND learner_name IS NULL AND course_name IS NULL AND version_number IS NULL AND chain_id IS NULL AND organization_name IS NULL AND logo_asset_key IS NULL AND logo_hash IS NULL AND logo_mime IS NULL AND logo_size IS NULL AND signer_name IS NULL AND signer_title IS NULL AND signature_asset_key IS NULL AND signature_hash IS NULL AND signature_mime IS NULL AND issued_recorded_at IS NULL AND next_attempt_at IS NOT NULL) OR (status='Issued' AND learner_name IS NOT NULL AND btrim(learner_name)<>'' AND course_name IS NOT NULL AND btrim(course_name)<>'' AND organization_name IS NOT NULL AND btrim(organization_name)<>'' AND version_number IS NOT NULL AND version_number>=1 AND chain_id IS NOT NULL AND issued_recorded_at IS NOT NULL AND next_attempt_at IS NULL AND last_error IS NULL AND lease_token IS NULL AND lease_until IS NULL));
ALTER TABLE certificates ADD CONSTRAINT ck_certificates_signature CHECK ( (signature_asset_key IS NULL AND signature_hash IS NULL AND signature_mime IS NULL) OR (signature_asset_key IS NOT NULL AND signature_asset_key<>'' AND signature_hash IS NOT NULL AND signature_hash ~ '^[0-9a-f]{64}$' AND signature_mime IS NOT NULL AND signature_mime IN ('image/png','image/jpeg') AND signer_name IS NOT NULL AND signer_title IS NOT NULL));
ALTER TABLE certificates ADD CONSTRAINT ck_certificates_organization_timezone CHECK ( (status='Pending' AND organization_timezone IS NULL) OR (status='Issued' AND organization_timezone IS NOT NULL AND btrim(organization_timezone)<>''));
ALTER TABLE certificates ADD CONSTRAINT ck_certificates_snapshot CHECK (jsonb_typeof(score_snapshot)='object' AND score_snapshot @> '{"schemaVersion":1}'::jsonb AND jsonb_typeof(score_snapshot->'eligible') = 'boolean');
CREATE UNIQUE INDEX "certificates_enrollment_id_key" ON "certificates"("enrollment_id");
CREATE UNIQUE INDEX "certificates_certificate_code_key" ON "certificates"("certificate_code");
CREATE INDEX "certificates_organization_id_course_id_idx" ON "certificates"("organization_id", "course_id");
CREATE UNIQUE INDEX "certificates_learner_id_course_id_key" ON "certificates"("learner_id", "course_id");
CREATE INDEX ix_certificates_org_learner_issued ON certificates(organization_id,learner_id) WHERE status='Issued';
CREATE INDEX ix_certificates_course_issued ON certificates(course_id) WHERE status='Issued';
CREATE INDEX ix_certificates_org_issued ON certificates(organization_id,issued_at) WHERE status='Issued';
CREATE INDEX ix_certificates_retry ON certificates(next_attempt_at,id) WHERE status='Pending';
CREATE TRIGGER trg_certificates_guard BEFORE INSERT OR UPDATE OR DELETE ON certificates FOR EACH ROW EXECUTE FUNCTION guard_certificate();
```

### `processed_completion_events`

| Column | PostgreSQL definition |
| --- | --- |
| `event_id` | `UUID NOT NULL` |
| `certificate_id` | `UUID NOT NULL` |
| `fingerprint` | `VARCHAR(64) NOT NULL` |
| `received_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

```sql
ALTER TABLE processed_completion_events ADD CONSTRAINT "processed_completion_events_pkey" PRIMARY KEY ("event_id");
ALTER TABLE processed_completion_events ADD CONSTRAINT "processed_completion_events_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE processed_completion_events ADD CONSTRAINT ck_completion_receipt_fingerprint CHECK (fingerprint ~ '^[0-9a-f]{64}$');
```

### `completion_event_quarantine`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `topic` | `TEXT NOT NULL` |
| `partition` | `INTEGER NOT NULL` |
| `offset` | `BIGINT NOT NULL` |
| `event_id` | `TEXT` |
| `reason` | `VARCHAR(64) NOT NULL` |
| `payload` | `JSONB NOT NULL` |
| `received_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

```sql
ALTER TABLE completion_event_quarantine ADD CONSTRAINT "completion_event_quarantine_pkey" PRIMARY KEY ("id");
ALTER TABLE completion_event_quarantine ADD CONSTRAINT ck_completion_quarantine_position CHECK ("partition">=0 AND "offset">=0);
CREATE UNIQUE INDEX "completion_event_quarantine_topic_partition_offset_key" ON "completion_event_quarantine"("topic", "partition", "offset");
```

### `evaluation_forms`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `certificate_id` | `UUID NOT NULL` |
| `enrollment_id` | `UUID NOT NULL` |
| `learner_id` | `UUID NOT NULL` |
| `course_id` | `UUID NOT NULL` |
| `opened_at` | `TIMESTAMPTZ NOT NULL` |
| `due_at` | `TIMESTAMPTZ NOT NULL` |
| `submitted_at` | `TIMESTAMPTZ` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE evaluation_forms ADD CONSTRAINT "evaluation_forms_pkey" PRIMARY KEY ("id");
ALTER TABLE evaluation_forms ADD CONSTRAINT "evaluation_forms_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "evaluation_forms_certificate_id_key" ON "evaluation_forms"("certificate_id");
CREATE UNIQUE INDEX "evaluation_forms_enrollment_id_key" ON "evaluation_forms"("enrollment_id");
CREATE INDEX "evaluation_forms_organization_id_learner_id_idx" ON "evaluation_forms"("organization_id", "learner_id");
```

### `evaluation_responses`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `course_id` | `UUID NOT NULL` |
| `content_usefulness` | `SMALLINT NOT NULL` |
| `difficulty_fit` | `SMALLINT NOT NULL` |
| `material_quality` | `SMALLINT NOT NULL` |
| `comment` | `VARCHAR(2000)` |

```sql
ALTER TABLE evaluation_responses ADD CONSTRAINT "evaluation_responses_pkey" PRIMARY KEY ("id");
CREATE INDEX "evaluation_responses_organization_id_course_id_idx" ON "evaluation_responses"("organization_id", "course_id");
```

### `report_exports`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `requested_by` | `UUID NOT NULL` |
| `requester_role` | `TEXT NOT NULL` |
| `report_type` | `TEXT NOT NULL` |
| `file_format` | `TEXT NOT NULL` |
| `filters` | `JSONB NOT NULL` |
| `status` | `TEXT NOT NULL` |
| `attempts` | `INTEGER NOT NULL DEFAULT 0` |
| `started_at` | `TIMESTAMPTZ` |
| `finished_at` | `TIMESTAMPTZ` |
| `file_key` | `TEXT` |
| `file_size_bytes` | `BIGINT` |
| `error_message` | `TEXT` |
| `expires_at` | `TIMESTAMPTZ` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE report_exports ADD CONSTRAINT "report_exports_pkey" PRIMARY KEY ("id");
CREATE INDEX "report_exports_organization_id_requested_by_status_idx" ON "report_exports"("organization_id", "requested_by", "status");
```

### `platform_settings`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `evaluation_form_days` | `INTEGER NOT NULL DEFAULT 14` |
| `source_as_of` | `TIMESTAMPTZ NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE platform_settings ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");
```

### `certificate_signer_settings`

| Column | PostgreSQL definition |
| --- | --- |
| `organization_id` | `UUID PRIMARY KEY` |
| `signer_name` | `VARCHAR(100) NOT NULL CHECK (btrim(signer_name)<>'')` |
| `signer_title` | `VARCHAR(200) NOT NULL CHECK (btrim(signer_title)<>'')` |
| `signature_asset_key` | `TEXT` |
| `signature_hash` | `VARCHAR(64)` |
| `signature_mime` | `TEXT` |
| `signature_size_bytes` | `INTEGER` |
| `version` | `INTEGER NOT NULL CHECK (version>=1)` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_by` | `UUID NOT NULL` |

```sql
ALTER TABLE certificate_signer_settings ADD CONSTRAINT ck_signer_settings_signature CHECK ( (signature_asset_key IS NULL AND signature_hash IS NULL AND signature_mime IS NULL AND signature_size_bytes IS NULL) OR (signature_asset_key IS NOT NULL AND signature_asset_key<>'' AND signature_hash IS NOT NULL AND signature_hash ~ '^[0-9a-f]{64}$' AND signature_mime IS NOT NULL AND signature_mime IN ('image/png','image/jpeg') AND signature_size_bytes IS NOT NULL AND signature_size_bytes>0 AND signature_size_bytes<=2097152));
```

### `storage_cleanup_tasks`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID PRIMARY KEY` |
| `asset_key` | `TEXT NOT NULL UNIQUE CHECK (asset_key<>'')` |
| `reason` | `VARCHAR(80) NOT NULL` |
| `not_before` | `TIMESTAMPTZ NOT NULL` |
| `attempts` | `INTEGER NOT NULL DEFAULT 0 CHECK (attempts>=0)` |
| `last_error` | `VARCHAR(80)` |
| `next_attempt_at` | `TIMESTAMPTZ NOT NULL` |
| `lease_token` | `UUID` |
| `lease_until` | `TIMESTAMPTZ` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

```sql
ALTER TABLE storage_cleanup_tasks ADD CONSTRAINT ck_cleanup_lease CHECK ((lease_token IS NULL AND lease_until IS NULL) OR (lease_token IS NOT NULL AND lease_until IS NOT NULL));
CREATE INDEX ix_storage_cleanup_due ON storage_cleanup_tasks(next_attempt_at,not_before);
```

## Provided to other services

- The [certificate API](../../contracts/openapi/achievement-reporting-service.yaml) covers learner-owned certificate reads and Organizer signer settings. The [enrollment event contract](../../contracts/events/learning-enrollment-events.md) describes the issuance input.
