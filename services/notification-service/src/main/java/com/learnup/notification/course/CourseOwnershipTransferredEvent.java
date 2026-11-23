
package com.learnup.notification.course;

import java.time.Instant;
import java.util.UUID;

public record CourseOwnershipTransferredEvent(
    UUID eventId,
    UUID organizationId,
    UUID courseId,
    UUID chainId,
    UUID fromInstructorId,
    UUID toInstructorId,
    UUID actorUserId,
    String courseName,
    String reason,
    Instant occurredAt
) {}
