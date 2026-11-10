package com.learnup.notification.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.response.ApiResponse;
import com.learnup.common.exception.BusinessException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
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

/** Authenticates only the private email API; it does not change in-app notification security. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class EmailServiceAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(EmailServiceAuthenticationFilter.class);
    private static final String AUTHENTICATED_SERVICE = EmailServiceAuthenticationFilter.class.getName() + ".authenticated";
    private final byte[] internalKey;
    private final ObjectMapper objectMapper;

    public EmailServiceAuthenticationFilter(@Value("${security.internal-key:}") String internalKey,
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
        return !isEmailPath(path, "/api/v1/notifications/email")
                && !isEmailPath(path, "/api/notifications/email");
    }

    private boolean isEmailPath(String path, String prefix) {
        return path.equals(prefix) || path.startsWith(prefix + "/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String correlationId = safeCorrelationId(request.getHeader("X-Correlation-ID"));
        String previous = MDC.get("correlationId");
        MDC.put("correlationId", correlationId);
        response.setHeader("X-Correlation-ID", correlationId);
        try {
            boolean userHeaders = request.getHeader("X-User-ID") != null
                    || request.getHeader("X-Organization-ID") != null
                    || request.getHeader("X-User-Role") != null
                    || request.getHeader("Authorization") != null;
            String supplied = request.getHeader("X-Internal-Key");
            if (userHeaders || supplied == null
                    || !MessageDigest.isEqual(internalKey, supplied.getBytes(StandardCharsets.UTF_8))) {
                log.warn("event=email_request_rejected reason={} correlation_id={}",
                        userHeaders ? "USER_CONTEXT_NOT_ALLOWED" : "INVALID_SERVICE_CREDENTIAL", correlationId);
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                objectMapper.writeValue(response.getOutputStream(),
                        ApiResponse.error("FORBIDDEN", "Authenticated internal service request required"));
                return;
            }
            request.setAttribute(AUTHENTICATED_SERVICE, Boolean.TRUE);
            try {
                chain.doFilter(request, response);
            } finally {
                request.removeAttribute(AUTHENTICATED_SERVICE);
            }
        } finally {
            if (previous == null) {
                MDC.remove("correlationId");
            } else {
                MDC.put("correlationId", previous);
            }
        }
    }

    /** Defense in depth if servlet path normalization differs from MVC route matching. */
    public static void requireAuthenticatedService(HttpServletRequest request) {
        if (!Boolean.TRUE.equals(request.getAttribute(AUTHENTICATED_SERVICE))) {
            throw BusinessException.forbidden("Authenticated internal service request required");
        }
    }

    private String safeCorrelationId(String candidate) {
        if (candidate != null && candidate.length() == 36) {
            try {
                if (UUID.fromString(candidate).toString().equalsIgnoreCase(candidate)) {
                    return candidate;
                }
            } catch (IllegalArgumentException ignored) {
                // Caller-controlled values are neither reflected nor logged.
            }
        }
        return UUID.randomUUID().toString();
    }
}
