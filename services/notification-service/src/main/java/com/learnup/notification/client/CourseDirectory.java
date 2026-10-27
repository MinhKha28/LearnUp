package com.learnup.notification.client;

import java.util.Optional;
import java.util.UUID;

/** What a Course is called. */
public interface CourseDirectory {

    /**
     * @return the name of the Course version, or empty when course-service does not know it in this Organization
     * @throws com.learnup.notification.enrollment.DependencyUnavailableException when the answer cannot be had now
     * @throws com.learnup.notification.enrollment.PermanentDeliveryException      when the request is refused
     */
    Optional<String> nameOf(UUID organizationId, UUID courseId);
}
