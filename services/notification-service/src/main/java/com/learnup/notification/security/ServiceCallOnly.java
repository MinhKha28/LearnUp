package com.learnup.notification.security;

import com.learnup.common.exception.BusinessException;

/**
 * Some endpoints are for other services only (creating a notification, sending an email, reading the email log).
 * A call that comes through the API Gateway carries X-User-ID, taken from the JWT; a service calling another service
 * has no user. So a request with a user is refused: otherwise any signed-in user could notify or email anyone.
 */
public final class ServiceCallOnly {

    private ServiceCallOnly() {
    }

    public static void require(String headerUserId) {
        if (headerUserId != null && !headerUserId.isBlank()) {
            throw BusinessException.forbidden("This endpoint is only for service-to-service calls.");
        }
    }
}
