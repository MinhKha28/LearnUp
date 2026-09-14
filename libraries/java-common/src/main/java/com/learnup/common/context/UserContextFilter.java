package com.learnup.common.context;

import com.learnup.common.security.UserRole;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

import static com.learnup.common.context.HeaderConstants.*;

/**
 * Servlet filter that intercepts incoming HTTP requests, extracts trusted Gateway headers
 * (X-User-ID, X-Organization-ID, X-User-Role, X-Correlation-ID), populates the ThreadLocal
 * RequestContext, and guarantees cleanup upon request completion.
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
public class UserContextFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(UserContextFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String userId = request.getHeader(X_USER_ID);
            String organizationId = request.getHeader(X_ORGANIZATION_ID);
            String roleHeader = request.getHeader(X_USER_ROLE);
            String correlationId = request.getHeader(X_CORRELATION_ID);

            if (correlationId == null || correlationId.isBlank()) {
                correlationId = UUID.randomUUID().toString();
            }

            UserRole role = null;
            if (roleHeader != null && !roleHeader.isBlank()) {
                try {
                    role = UserRole.fromHeader(roleHeader);
                } catch (IllegalArgumentException ex) {
                    log.warn("Received unrecognized role header '{}' for user '{}'", roleHeader, userId);
                }
            }

            RequestContext context = RequestContext.builder()
                    .userId(userId != null && !userId.isBlank() ? userId.trim() : null)
                    .organizationId(organizationId != null && !organizationId.isBlank() ? organizationId.trim() : null)
                    .role(role)
                    .correlationId(correlationId.trim())
                    .build();

            RequestContextHolder.set(context);

            // Echo correlation ID back in response headers for tracing
            response.setHeader(X_CORRELATION_ID, correlationId);

            filterChain.doFilter(request, response);
        } finally {
            RequestContextHolder.clear();
        }
    }
}
