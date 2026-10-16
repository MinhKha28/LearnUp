CREATE TABLE login_throttles (
    identifier VARCHAR(254) PRIMARY KEY,
    failed_count INTEGER NOT NULL,
    window_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    locked_until TIMESTAMP WITH TIME ZONE
);
