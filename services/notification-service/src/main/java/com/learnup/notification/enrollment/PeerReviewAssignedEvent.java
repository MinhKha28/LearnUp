package com.learnup.notification.enrollment;

import java.time.Instant;
import java.util.UUID;

/**
 * The event of assessment-service that tells a reviewer what a closed peer review cycle handed out (BR-232). The
 * identity of the event (id, time, Organization) comes from the envelope; the rest comes from {@code data}. There is
 * nothing about the authors of the submissions in it (BR-233).
 *
 * @param reviewerId      the Learner who has to review (the {@code learnerId} of the data)
 * @param assessmentId    the Assignment
 * @param cycleId         the cycle that was closed
 * @param assignmentTitle the title of the Assignment as the Instructor wrote it
 * @param reviewCount     how many submissions this reviewer has to review (at least 1)
 * @param reviewDueAt     when the reviews are due
 */
public record PeerReviewAssignedEvent(
        UUID eventId,
        Instant occurredAt,
        UUID organizationId,
        UUID reviewerId,
        UUID assessmentId,
        UUID cycleId,
        String assignmentTitle,
        int reviewCount,
        Instant reviewDueAt) {

    /** The name of the event on the wire. */
    public static final String WIRE_NAME = "PeerReviewAssigned";
}
