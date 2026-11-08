package com.learnup.notification.course;

import java.time.Instant;
import java.util.UUID;

/** Validated UC20 CourseSubmitted event, from Course Service's Outbox. */
public record CourseSubmittedEvent(
        UUID eventId,
        UUID organizationId,
        UUID courseId,
        UUID instructorId,
        String courseName,
        int versionNumber,
        Instant submittedAt,
        Instant occurredAt) {}
