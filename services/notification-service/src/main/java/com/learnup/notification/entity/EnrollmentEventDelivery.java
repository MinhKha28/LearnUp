package com.learnup.notification.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * What the service owes to one person for one learning event, on one channel, and what became of it.
 * (event, recipient, channel) is unique, so the same event never produces the same message twice.
 */
@Entity
@Table(name = "enrollment_event_deliveries")
public class EnrollmentEventDelivery {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "event_id", nullable = false, updatable = false)
    private UUID eventId;

    @Column(name = "event_type", nullable = false, updatable = false, length = 60)
    private String eventType;

    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;

    @Column(name = "enrollment_id", nullable = false, updatable = false)
    private UUID enrollmentId;

    @Column(name = "recipient_user_id", nullable = false, updatable = false)
    private UUID recipientUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false, updatable = false, length = 20)
    private DeliveryChannel channel;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private DeliveryStatus status;

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "last_error", length = 100)
    private String lastError;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected EnrollmentEventDelivery() {
    }

    public EnrollmentEventDelivery(UUID eventId, String eventType, UUID organizationId, UUID enrollmentId,
                                   UUID recipientUserId, DeliveryChannel channel, Instant occurredAt, Instant now) {
        this.id = UUID.randomUUID();
        this.eventId = eventId;
        this.eventType = eventType;
        this.organizationId = organizationId;
        this.enrollmentId = enrollmentId;
        this.recipientUserId = recipientUserId;
        this.channel = channel;
        this.status = DeliveryStatus.PENDING;
        this.attempts = 0;
        this.occurredAt = occurredAt;
        this.createdAt = now;
        this.updatedAt = now;
    }

    /** One more try is starting. */
    public void startAttempt(Instant now) {
        this.attempts++;
        this.updatedAt = now;
    }

    public void markSent(Instant now) {
        this.status = DeliveryStatus.SENT;
        this.lastError = null;
        this.sentAt = now;
        this.updatedAt = now;
    }

    /** {@code code} is a fixed identifier, never text of a payload or of an exception. */
    public void markFailed(String code, Instant now) {
        this.status = DeliveryStatus.FAILED;
        this.lastError = code;
        this.updatedAt = now;
    }

    public void markSkipped(String code, Instant now) {
        this.status = DeliveryStatus.SKIPPED;
        this.lastError = code;
        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UUID getEventId() {
        return eventId;
    }

    public String getEventType() {
        return eventType;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public UUID getEnrollmentId() {
        return enrollmentId;
    }

    public UUID getRecipientUserId() {
        return recipientUserId;
    }

    public DeliveryChannel getChannel() {
        return channel;
    }

    public DeliveryStatus getStatus() {
        return status;
    }

    public int getAttempts() {
        return attempts;
    }

    public String getLastError() {
        return lastError;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public Instant getSentAt() {
        return sentAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
