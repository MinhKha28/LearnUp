package com.learnup.notification.enrollment;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** NEW BR-254: an immutable result snapshot, without grading comments. */
public record SubmissionFinalizedEvent(UUID eventId, Instant occurredAt, UUID organizationId,
        UUID learnerId, UUID submissionId, UUID assessmentId, String assessmentTitle,
        BigDecimal finalScore, BigDecimal maxScore, UUID courseId, Instant finalizedAt) {
    public static final String WIRE_NAME = "SubmissionFinalized";
}
