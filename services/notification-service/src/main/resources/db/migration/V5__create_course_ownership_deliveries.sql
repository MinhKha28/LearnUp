-- UC23: independent durable obligations for notification and audit delivery.
CREATE TABLE course_ownership_deliveries (
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
    CONSTRAINT uq_course_ownership_delivery UNIQUE (event_id, recipient_user_id, channel),
    CONSTRAINT ck_course_ownership_channel CHECK (channel IN ('IN_APP', 'EMAIL', 'AUDIT')),
    CONSTRAINT ck_course_ownership_status CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED')),
    CONSTRAINT ck_course_ownership_claim CHECK (status <> 'PROCESSING' OR claimed_at IS NOT NULL),
    CONSTRAINT ck_course_ownership_attempts CHECK (attempts >= 0)
);
CREATE INDEX idx_course_ownership_delivery_status
ON course_ownership_deliveries(status, created_at);
