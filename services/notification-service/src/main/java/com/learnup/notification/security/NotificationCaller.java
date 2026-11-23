package com.learnup.notification.security;

import com.learnup.common.exception.BusinessException;
import jakarta.servlet.http.HttpServletRequest;

import java.util.UUID;

/**
 * The authenticated caller of an in-app notification endpoint, established only by
 * {@link InAppNotificationAuthenticationFilter} after the internal key was verified.
 * A user caller comes from the Gateway (JWT subject and Organization claim); a service
 * caller is another LearnUP service with no user context. Never built from client input.
 */
public record NotificationCaller(UUID userId, UUID organizationId) {

    static final String ATTRIBUTE = NotificationCaller.class.getName();

    public static NotificationCaller service() {
        return new NotificationCaller(null, null);
    }

    public boolean isUser() {
        return userId != null;
    }

    /** Defense in depth: refuse if the filter did not authenticate this request. */
    public static NotificationCaller of(HttpServletRequest request) {
        if (request.getAttribute(ATTRIBUTE) instanceof NotificationCaller caller) {
            return caller;
        }
        throw BusinessException.unauthorized("Authenticated request required");
    }

    /** UC49 user endpoints: the recipient is always the authenticated user. */
    public static NotificationCaller requireUser(HttpServletRequest request) {
        NotificationCaller caller = of(request);
        if (!caller.isUser()) {
            throw BusinessException.unauthorized("Authenticated user required");
        }
        return caller;
    }

    /** Service-only endpoints (creating a notification): a signed-in user may not notify anyone. */
    public static void requireService(HttpServletRequest request) {
        if (of(request).isUser()) {
            throw BusinessException.forbidden("This endpoint is only for service-to-service calls.");
        }
    }
}
