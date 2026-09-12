package com.learnup.common.filter;

import com.learnup.common.constant.HeaderConstants;
import com.learnup.common.context.SecurityContextHolder;
import com.learnup.common.context.UserContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filter that extracts authenticated internal headers (injected by API Gateway) and binds them
 * to the execution context and MDC logging context.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class TenantSecurityFilter extends OncePerRequestFilter {

    private static final String MDC_USER_ID_KEY = "userId";
    private static final String MDC_ORG_ID_KEY = "organizationId";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String userId = request.getHeader(HeaderConstants.X_USER_ID);
        String organizationId = request.getHeader(HeaderConstants.X_ORGANIZATION_ID);
        String correlationId = request.getHeader(HeaderConstants.X_CORRELATION_ID);

        if (userId != null || organizationId != null) {
            UserContext context = UserContext.builder()
                    .userId(userId)
                    .organizationId(organizationId)
                    .correlationId(correlationId)
                    .build();
            SecurityContextHolder.setContext(context);

            if (userId != null) {
                MDC.put(MDC_USER_ID_KEY, userId);
            }
            if (organizationId != null) {
                MDC.put(MDC_ORG_ID_KEY, organizationId);
            }
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clear();
            MDC.remove(MDC_USER_ID_KEY);
            MDC.remove(MDC_ORG_ID_KEY);
        }
    }
}
