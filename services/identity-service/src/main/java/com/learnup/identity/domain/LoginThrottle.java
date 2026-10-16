package com.learnup.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "login_throttles")
public class LoginThrottle {

    @Id
    @Column(name = "identifier", nullable = false, updatable = false, length = 254)
    private String identifier;

    @Column(name = "failed_count", nullable = false)
    private int failedCount;

    @Column(name = "window_started_at", nullable = false)
    private Instant windowStartedAt;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    public LoginThrottle() {
    }

    public LoginThrottle(String identifier, Instant windowStartedAt) {
        this.identifier = identifier;
        this.failedCount = 0;
        this.windowStartedAt = windowStartedAt;
    }

    public String getIdentifier() {
        return identifier;
    }

    public int getFailedCount() {
        return failedCount;
    }

    public void setFailedCount(int failedCount) {
        this.failedCount = failedCount;
    }

    public Instant getWindowStartedAt() {
        return windowStartedAt;
    }

    public void setWindowStartedAt(Instant windowStartedAt) {
        this.windowStartedAt = windowStartedAt;
    }

    public Instant getLockedUntil() {
        return lockedUntil;
    }

    public void setLockedUntil(Instant lockedUntil) {
        this.lockedUntil = lockedUntil;
    }
}
