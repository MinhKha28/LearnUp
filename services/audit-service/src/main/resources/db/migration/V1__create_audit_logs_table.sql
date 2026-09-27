CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    organization_id UUID,
    actor_user_id UUID,
    actor_role VARCHAR(50),
    action_type VARCHAR(100) NOT NULL,
    target_resource_type VARCHAR(100),
    target_resource_id VARCHAR(255),
    details TEXT,
    ip_address VARCHAR(100),
    correlation_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_resource ON audit_logs(target_resource_type, target_resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
