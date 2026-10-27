-- One row for each thing the service owes to one person for one learning event: one e-mail, one in-app notice.
-- The unique key is what makes a repeated event harmless (Kafka delivers at least once).
CREATE TABLE enrollment_event_deliveries (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL,
    event_type VARCHAR(60) NOT NULL,
    organization_id UUID NOT NULL,
    enrollment_id UUID NOT NULL,
    recipient_user_id UUID NOT NULL,
    channel VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    -- A fixed code (for example TENANT_UNAVAILABLE), never text that came from a payload or from a broker.
    last_error VARCHAR(100),
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_enrollment_event_delivery UNIQUE (event_id, recipient_user_id, channel),
    CONSTRAINT ck_enrollment_event_delivery_status CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
    CONSTRAINT ck_enrollment_event_delivery_channel CHECK (channel IN ('EMAIL', 'IN_APP')),
    CONSTRAINT ck_enrollment_event_delivery_attempts CHECK (attempts >= 0)
);

CREATE INDEX idx_enrollment_event_deliveries_enrollment ON enrollment_event_deliveries(enrollment_id);
CREATE INDEX idx_enrollment_event_deliveries_status ON enrollment_event_deliveries(status, created_at);
