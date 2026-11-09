-- UC20 delivery ledger: one obligation per event/Organizer/channel.
CREATE TABLE course_submission_deliveries (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    course_id UUID NOT NULL,
    recipient_user_id UUID NOT NULL,
    channel VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error VARCHAR(100),
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_course_submission_delivery UNIQUE (event_id, recipient_user_id, channel),
    CONSTRAINT ck_course_submission_channel CHECK (channel IN ('IN_APP', 'EMAIL')),
    CONSTRAINT ck_course_submission_status CHECK
      (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED')),
    CONSTRAINT ck_course_submission_claim CHECK
      (status <> 'PROCESSING' OR claimed_at IS NOT NULL),
    CONSTRAINT ck_course_submission_attempts CHECK (attempts >= 0)
);

CREATE INDEX idx_course_submission_delivery_status
ON course_submission_deliveries(status, created_at);
