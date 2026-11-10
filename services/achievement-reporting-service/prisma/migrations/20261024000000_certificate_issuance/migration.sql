-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "certificate_code" VARCHAR(12) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "issued_at" TIMESTAMPTZ NOT NULL,
    "completed_late" BOOLEAN NOT NULL,
    "score_snapshot" JSONB NOT NULL,
    "learner_name" VARCHAR(100),
    "course_name" VARCHAR(200),
    "version_number" INTEGER,
    "chain_id" UUID,
    "completion_fingerprint" VARCHAR(64) NOT NULL,
    "organization_name" VARCHAR(200),
    "logo_asset_key" TEXT,
    "logo_hash" VARCHAR(64),
    "logo_mime" TEXT,
    "logo_size" INTEGER,
    "signer_name" VARCHAR(100),
    "signer_title" VARCHAR(200),
    "signature_asset_key" TEXT,
    "signature_hash" VARCHAR(64),
    "signature_mime" TEXT,
    "issued_recorded_at" TIMESTAMPTZ,
    "lease_token" UUID,
    "lease_until" TIMESTAMPTZ,
    "issue_attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_completion_events" (
    "event_id" UUID NOT NULL,
    "certificate_id" UUID NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_completion_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "completion_event_quarantine" (
    "id" UUID NOT NULL,
    "topic" TEXT NOT NULL,
    "partition" INTEGER NOT NULL,
    "offset" BIGINT NOT NULL,
    "event_id" TEXT,
    "reason" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "completion_event_quarantine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_forms" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "certificate_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "opened_at" TIMESTAMPTZ NOT NULL,
    "due_at" TIMESTAMPTZ NOT NULL,
    "submitted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "evaluation_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_responses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "content_usefulness" SMALLINT NOT NULL,
    "difficulty_fit" SMALLINT NOT NULL,
    "material_quality" SMALLINT NOT NULL,
    "comment" VARCHAR(2000),

    CONSTRAINT "evaluation_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_exports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "requester_role" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "file_format" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ,
    "finished_at" TIMESTAMPTZ,
    "file_key" TEXT,
    "file_size_bytes" BIGINT,
    "error_message" TEXT,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "report_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" UUID NOT NULL,
    "evaluation_form_days" INTEGER NOT NULL DEFAULT 14,
    "source_as_of" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificates_enrollment_id_key" ON "certificates"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_certificate_code_key" ON "certificates"("certificate_code");

-- CreateIndex
CREATE INDEX "certificates_organization_id_course_id_idx" ON "certificates"("organization_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_learner_id_course_id_key" ON "certificates"("learner_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "completion_event_quarantine_topic_partition_offset_key" ON "completion_event_quarantine"("topic", "partition", "offset");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_forms_certificate_id_key" ON "evaluation_forms"("certificate_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_forms_enrollment_id_key" ON "evaluation_forms"("enrollment_id");

-- CreateIndex
CREATE INDEX "evaluation_forms_organization_id_learner_id_idx" ON "evaluation_forms"("organization_id", "learner_id");

-- CreateIndex
CREATE INDEX "evaluation_responses_organization_id_course_id_idx" ON "evaluation_responses"("organization_id", "course_id");

-- CreateIndex
CREATE INDEX "report_exports_organization_id_requested_by_status_idx" ON "report_exports"("organization_id", "requested_by", "status");

-- AddForeignKey
ALTER TABLE "processed_completion_events" ADD CONSTRAINT "processed_completion_events_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_forms" ADD CONSTRAINT "evaluation_forms_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Application/Prisma supplies UUID v7 on PostgreSQL 16; no uuidv7 extension is required.
ALTER TABLE certificates
  ADD CONSTRAINT ck_certificates_status CHECK (status IN ('Pending','Issued')),
  ADD CONSTRAINT ck_certificates_code CHECK (certificate_code ~ '^[0-9A-HJKMNP-TV-Z]{12}$'),
  ADD CONSTRAINT ck_certificates_fingerprint CHECK (completion_fingerprint ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT ck_certificates_snapshot CHECK (jsonb_typeof(score_snapshot)='object' AND score_snapshot @> '{"schemaVersion":1,"eligible":true}'::jsonb),
  ADD CONSTRAINT ck_certificates_attempts CHECK (issue_attempts>=0),
  ADD CONSTRAINT ck_certificates_lease CHECK ((lease_token IS NULL AND lease_until IS NULL) OR (lease_token IS NOT NULL AND lease_until IS NOT NULL)),
  ADD CONSTRAINT ck_certificates_logo CHECK (
    (logo_asset_key IS NULL AND logo_hash IS NULL AND logo_mime IS NULL AND logo_size IS NULL) OR
    (logo_asset_key IS NOT NULL AND logo_asset_key<>'' AND logo_hash IS NOT NULL AND logo_hash ~ '^[0-9a-f]{64}$' AND
     logo_mime IS NOT NULL AND logo_mime IN ('image/png','image/jpeg','image/webp') AND logo_size IS NOT NULL AND logo_size>0)),
  ADD CONSTRAINT ck_certificates_signer CHECK (
    (signer_name IS NULL AND signer_title IS NULL) OR
    (signer_name IS NOT NULL AND btrim(signer_name)<>'' AND signer_title IS NOT NULL AND btrim(signer_title)<>'')),
  ADD CONSTRAINT ck_certificates_signature CHECK (
    (signature_asset_key IS NULL AND signature_hash IS NULL AND signature_mime IS NULL) OR
    (signature_asset_key IS NOT NULL AND signature_asset_key<>'' AND signature_hash IS NOT NULL AND signature_hash ~ '^[0-9a-f]{64}$' AND
     signature_mime IS NOT NULL AND signature_mime IN ('image/png','image/jpeg','image/webp') AND signer_name IS NOT NULL AND signer_title IS NOT NULL)),
  ADD CONSTRAINT ck_certificates_lifecycle CHECK (
    (status='Pending' AND learner_name IS NULL AND course_name IS NULL AND version_number IS NULL AND chain_id IS NULL AND organization_name IS NULL
      AND logo_asset_key IS NULL AND logo_hash IS NULL AND logo_mime IS NULL AND logo_size IS NULL AND signer_name IS NULL AND signer_title IS NULL
      AND signature_asset_key IS NULL AND signature_hash IS NULL AND signature_mime IS NULL AND issued_recorded_at IS NULL AND next_attempt_at IS NOT NULL) OR
    (status='Issued' AND learner_name IS NOT NULL AND btrim(learner_name)<>'' AND course_name IS NOT NULL AND btrim(course_name)<>''
      AND organization_name IS NOT NULL AND btrim(organization_name)<>'' AND version_number IS NOT NULL AND version_number>=1 AND chain_id IS NOT NULL
      AND issued_recorded_at IS NOT NULL AND next_attempt_at IS NULL AND last_error IS NULL AND lease_token IS NULL AND lease_until IS NULL));

CREATE INDEX ix_certificates_org_learner_issued ON certificates(organization_id,learner_id) WHERE status='Issued';
CREATE INDEX ix_certificates_course_issued ON certificates(course_id) WHERE status='Issued';
CREATE INDEX ix_certificates_org_issued ON certificates(organization_id,issued_at) WHERE status='Issued';
CREATE INDEX ix_certificates_retry ON certificates(next_attempt_at,id) WHERE status='Pending';
ALTER TABLE processed_completion_events ADD CONSTRAINT ck_completion_receipt_fingerprint CHECK (fingerprint ~ '^[0-9a-f]{64}$');
ALTER TABLE completion_event_quarantine ADD CONSTRAINT ck_completion_quarantine_position CHECK ("partition">=0 AND "offset">=0);

CREATE FUNCTION guard_certificate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Certificate deletion forbidden' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'Pending' THEN RAISE EXCEPTION 'Certificate must start Pending' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.status='Issued' THEN RAISE EXCEPTION 'Issued Certificate is immutable' USING ERRCODE='23514'; END IF;
  IF ROW(NEW.id,NEW.organization_id,NEW.enrollment_id,NEW.learner_id,NEW.course_id,NEW.certificate_code,NEW.issued_at,NEW.completed_late,NEW.score_snapshot,NEW.completion_fingerprint,NEW.created_at)
     IS DISTINCT FROM ROW(OLD.id,OLD.organization_id,OLD.enrollment_id,OLD.learner_id,OLD.course_id,OLD.certificate_code,OLD.issued_at,OLD.completed_late,OLD.score_snapshot,OLD.completion_fingerprint,OLD.created_at)
  THEN RAISE EXCEPTION 'Certificate completion data is immutable' USING ERRCODE='23514'; END IF;
  IF NEW.status='Pending' AND
     (to_jsonb(NEW)-ARRAY['issue_attempts','next_attempt_at','last_error','lease_token','lease_until','updated_at'])
       IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['issue_attempts','next_attempt_at','last_error','lease_token','lease_until','updated_at'])
  THEN RAISE EXCEPTION 'Snapshots can only be set when issuing' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_certificates_guard BEFORE INSERT OR UPDATE OR DELETE ON certificates FOR EACH ROW EXECUTE FUNCTION guard_certificate();
