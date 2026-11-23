package com.learnup.notification.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.HeaderConstants;
import com.learnup.common.response.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.UUID;

/**
 * UC49 trust boundary for the in-app notification API (everything under /notifications except the
 * email API, which {@link EmailServiceAuthenticationFilter} guards). Every request must carry the
 * internal service key; only the Gateway (which strips client copies and injects identity from the
 * verified JWT) and LearnUP services hold it. User identity comes solely from Gateway headers and
 * must be well-formed; nothing is ever taken from request parameters.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 11)
public class InAppNotificationAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(InAppNotificationAuthenticationFilter.class);

    private final byte[] internalKey;
    private final ObjectMapper objectMapper;

    public InAppNotificationAuthenticationFilter(@Value("${security.internal-key:}") String internalKey,
                                                 ObjectMapper objectMapper) {
        if (internalKey == null || internalKey.isBlank()
                || internalKey.getBytes(StandardCharsets.UTF_8).length < 32
                || "learnup-internal-secret".equals(internalKey.trim())) {
            throw new IllegalStateException("security.internal-key requires a private value of at least 32 bytes");
        }
        this.internalKey = internalKey.getBytes(StandardCharsets.UTF_8);
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        if (path.isEmpty()) {
            path = request.getRequestURI().substring(request.getContextPath().length());
        }
        path = path.replaceAll(";[^/]*", "");
        boolean notifications = under(path, "/api/v1/notifications") || under(path, "/api/notifications");
        boolean email = under(path, "/api/v1/notifications/email") || under(path, "/api/notifications/email");
        return !notifications || email;
    }

    private static boolean under(String path, String prefix) {
        return path.equals(prefix) || path.startsWith(prefix + "/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String supplied = request.getHeader(HeaderConstants.X_INTERNAL_KEY);
        if (supplied == null || !MessageDigest.isEqual(internalKey, supplied.getBytes(StandardCharsets.UTF_8))) {
            reject(response, "INVALID_SERVICE_CREDENTIAL");
            return;
        }
        NotificationCaller caller;
        String userId = request.getHeader(HeaderConstants.X_USER_ID);
        String organizationId = request.getHeader(HeaderConstants.X_ORGANIZATION_ID);
        if (userId == null) {
            // A service call carries no user context at all; partial user context is not trusted.
            if (organizationId != null || request.getHeader(HeaderConstants.X_USER_ROLE) != null) {
                reject(response, "INCOMPLETE_USER_CONTEXT");
                return;
            }
            caller = NotificationCaller.service();
        } else {
            UUID user = uuid(userId);
            UUID organization = organizationId == null ? null : uuid(organizationId);
            if (user == null || (organizationId != null && organization == null)) {
                reject(response, "MALFORMED_USER_CONTEXT");
                return;
            }
            caller = new NotificationCaller(user, organization);
        }
        request.setAttribute(NotificationCaller.ATTRIBUTE, caller);
        try {
            chain.doFilter(request, response);
        } finally {
            request.removeAttribute(NotificationCaller.ATTRIBUTE);
        }
    }

    private static UUID uuid(String value) {
        try {
            UUID parsed = UUID.fromString(value.trim());
            return parsed.toString().equalsIgnoreCase(value.trim()) ? parsed : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private void reject(HttpServletResponse response, String reason) throws IOException {
        log.warn("event=notification_request_rejected reason={}", reason);
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(),
                ApiResponse.error("UNAUTHORIZED", "Authenticated request required"));
    }
}
