package com.learnup.notification.client;

import java.util.Optional;
import java.util.UUID;

/** Who a user is: the name and the e-mail to write to. */
public interface RecipientDirectory {

    /**
     * @return the user of the Organization, or empty when the Organization has no such user
     * @throws com.learnup.notification.enrollment.DependencyUnavailableException when the answer cannot be had now
     * @throws com.learnup.notification.enrollment.PermanentDeliveryException      when the request is refused
     */
    Optional<Recipient> find(UUID organizationId, UUID userId);
}
