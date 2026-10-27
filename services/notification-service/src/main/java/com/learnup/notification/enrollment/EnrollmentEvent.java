package com.learnup.notification.enrollment;

import java.time.Instant;
import java.util.UUID;

/**
 * An enrollment event as this service needs it. The identity of the event (id, time, Organization) comes from the
 * envelope; the Enrollment, the Learner and the Course come from {@code data}. Fields that do not belong to the type
 * of the event are null.
 *
 * @param kind          ASSIGNED only
 * @param dueAt         ASSIGNED only; null when the kind has no due date
 * @param previousDueAt DUE_DATE_EXTENDED only; may be null
 * @param newDueAt      DUE_DATE_EXTENDED only
 * @param reason        DUE_DATE_EXTENDED and EXEMPTED; may be null
 */
public record EnrollmentEvent(
        UUID eventId,
        EnrollmentEventType type,
        Instant occurredAt,
        UUID organizationId,
        UUID enrollmentId,
        UUID learnerId,
        UUID courseId,
        AssignmentKind kind,
        Instant dueAt,
        Instant previousDueAt,
        Instant newDueAt,
        String reason) {
}
