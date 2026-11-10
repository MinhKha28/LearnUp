package com.learnup.audit.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.response.ApiResponse;
import com.learnup.common.security.UserRole;
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
 * Who may use the audit API (UC50, UC51; the trail is append-only).
 * <ul>
 *   <li>Every request needs the shared internal key (the gateway adds it; so do the services). Without it: 401.</li>
 *   <li>Writing an entry is for the services only: a request that carries a user context is refused (403).</li>
 *   <li>Reading is for a user: an Admin reads everything, an Organizer reads the own Organization (a valid
 *       {@code X-Organization-ID} is required); Instructors, Learners and anything else get 403.</li>
 * </ul>
 * Everything except the health endpoint goes through this filter, so a path written another way cannot skip it.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class AuditServiceAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(AuditServiceAuthenticationFilter.class);
    private static final String AUTHENTICATED_SERVICE = AuditServiceAuthenticationFilter.class.getName() + ".service";
    private final byte[] internalKey;
    private final ObjectMapper objectMapper;

    public AuditServiceAuthenticationFilter(@Value("${security.internal-key:}") String internalKey, ObjectMapper objectMapper) {
        if (internalKey == null || internalKey.isBlank()
                || internalKey.getBytes(StandardCharsets.UTF_8).length < 32
                || "learnup-internal-secret".equals(internalKey.trim())) {
            throw new IllegalStateException("security.internal-key requires a private value of at least 32 bytes (INTERNAL_SERVICE_KEY)");
        }
        this.internalKey = internalKey.getBytes(StandardCharsets.UTF_8);
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length()).replaceAll(";[^/]*", "");
        return path.equals("/actuator/health") || path.startsWith("/actuator/health/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String supplied = request.getHeader("x-internal-key");
        if (supplied == null || !MessageDigest.isEqual(internalKey, supplied.getBytes(StandardCharsets.UTF_8))) {
            reject(response, HttpServletResponse.SC_UNAUTHORIZED, "UNAUTHORIZED",
                    "Authenticated internal request required", "INVALID_SERVICE_CREDENTIAL");
            return;
        }
        boolean userContext = request.getHeader("X-User-ID") != null
                || request.getHeader("X-Organization-ID") != null
                || request.getHeader("X-User-Role") != null
                || request.getHeader("Authorization") != null;
        String method = request.getMethod();
        boolean read = "GET".equals(method) || "HEAD".equals(method) || "OPTIONS".equals(method);

        if (!read) {
            if (userContext) {
                reject(response, HttpServletResponse.SC_FORBIDDEN, "FORBIDDEN",
                        "Only internal services may write audit entries", "WRITE_WITH_USER_CONTEXT");
                return;
            }
            request.setAttribute(AUTHENTICATED_SERVICE, Boolean.TRUE);
        } else {
            AuditCaller caller = callerOf(request);
            if (caller == null) {
                reject(response, HttpServletResponse.SC_FORBIDDEN, "FORBIDDEN",
                        "Only an Admin or an Organizer can read the audit trail", "READER_NOT_ALLOWED");
                return;
            }
            request.setAttribute(AuditCaller.REQUEST_ATTRIBUTE, caller);
        }
        chain.doFilter(request, response);
    }

    /** The Admin, or the Organizer with an Organization; null for every other case (no user, another role, a bad value). */
    private AuditCaller callerOf(HttpServletRequest request) {
        String roleHeader = request.getHeader("X-User-Role");
        if (roleHeader == null || roleHeader.isBlank()) {
            return null;
        }
        UserRole role;
        try {
            role = UserRole.fromHeader(roleHeader);
        } catch (IllegalArgumentException invalid) {
            return null;
        }
        if (role == UserRole.ADMIN) {
            return new AuditCaller(role, null);
        }
        if (role == UserRole.ORGANIZER) {
            try {
                String organization = request.getHeader("X-Organization-ID");
                return organization == null ? null : new AuditCaller(role, UUID.fromString(organization.trim()));
            } catch (IllegalArgumentException invalid) {
                return null;
            }
        }
        return null;
    }

    private void reject(HttpServletResponse response, int status, String code, String message, String reason) throws IOException {
        // The reason is a fixed code: nothing the caller sent is logged or echoed.
        log.warn("event=audit_request_rejected reason={}", reason);
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), ApiResponse.error(code, message));
    }

    /** Defense in depth for a write: the filter marks only a request from an authenticated service. */
    public static boolean isAuthenticatedService(HttpServletRequest request) {
        return Boolean.TRUE.equals(request.getAttribute(AUTHENTICATED_SERVICE));
    }
}
