package com.learnup.notification.course;

import java.time.Instant;
import java.util.UUID;

/**
 * Validated UC21.3 review decision from Course Service's Outbox ({@code CoursePublished} or {@code CourseRejected},
 * contract {@code contracts/events/course-review-decision.json}). UC49: the Instructor is told the result.
 */
public record CourseDecisionEvent(
        UUID eventId,
        UUID organizationId,
        UUID courseId,
        UUID instructorId,
        String courseName,
        int versionNumber,
        boolean approved,
        String rejectionReason,
        Instant occurredAt) {}
