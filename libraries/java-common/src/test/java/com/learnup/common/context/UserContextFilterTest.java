package com.learnup.common.context;

import com.learnup.common.security.UserRole;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static com.learnup.common.context.HeaderConstants.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserContextFilterTest {

    private final UserContextFilter filter = new UserContextFilter();

    @AfterEach
    void tearDown() {
        RequestContextHolder.clear();
    }

    @Test
    @DisplayName("Should extract headers and populate RequestContext inside filter chain execution")
    void shouldExtractHeadersAndPopulateContext() throws ServletException, IOException {
        String userId = UUID.randomUUID().toString();
        String orgId = UUID.randomUUID().toString();
        String correlationId = "trace-correlation-abc-123";

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(X_USER_ID, userId);
        request.addHeader(X_ORGANIZATION_ID, orgId);
        request.addHeader(X_USER_ROLE, "INSTRUCTOR");
        request.addHeader(X_CORRELATION_ID, correlationId);

        MockHttpServletResponse response = new MockHttpServletResponse();

        AtomicReference<RequestContext> capturedContext = new AtomicReference<>();

        FilterChain chain = (req, res) -> {
            capturedContext.set(RequestContextHolder.get());
        };

        filter.doFilter(request, response, chain);

        // Verify captured context during chain execution
        RequestContext ctx = capturedContext.get();
        assertThat(ctx).isNotNull();
        assertThat(ctx.getUserId()).isEqualTo(userId);
        assertThat(ctx.getOrganizationId()).isEqualTo(orgId);
        assertThat(ctx.getRole()).isEqualTo(UserRole.INSTRUCTOR);
        assertThat(ctx.getCorrelationId()).isEqualTo(correlationId);

        // Verify response header contains correlationId
        assertThat(response.getHeader(X_CORRELATION_ID)).isEqualTo(correlationId);

        // Verify context is cleared after filter completes
        assertThat(RequestContextHolder.get()).isNull();
    }

    @Test
    @DisplayName("Should generate correlation ID when missing and attach to response header")
    void shouldGenerateCorrelationIdWhenMissing() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        AtomicReference<String> generatedCorrelationId = new AtomicReference<>();

        FilterChain chain = (req, res) -> {
            generatedCorrelationId.set(CorrelationContext.getCorrelationId());
        };

        filter.doFilter(request, response, chain);

        assertThat(generatedCorrelationId.get()).isNotBlank();
        assertThat(response.getHeader(X_CORRELATION_ID)).isEqualTo(generatedCorrelationId.get());
        assertThat(RequestContextHolder.get()).isNull();
    }

    @Test
    @DisplayName("Should handle missing optional headers and unrecognized role gracefully")
    void shouldHandleMissingAndInvalidHeadersGracefully() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(X_USER_ROLE, "UNRECOGNIZED_ROLE_VALUE");

        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<RequestContext> capturedContext = new AtomicReference<>();

        FilterChain chain = (req, res) -> {
            capturedContext.set(RequestContextHolder.get());
        };

        filter.doFilter(request, response, chain);

        RequestContext ctx = capturedContext.get();
        assertThat(ctx).isNotNull();
        assertThat(ctx.getUserId()).isNull();
        assertThat(ctx.getOrganizationId()).isNull();
        assertThat(ctx.getRole()).isNull();
        assertThat(ctx.getCorrelationId()).isNotBlank();

        assertThat(RequestContextHolder.get()).isNull();
    }

    @Test
    @DisplayName("Should guarantee context cleanup even when downstream filter chain throws an exception")
    void shouldGuaranteeCleanupOnException() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(X_USER_ID, "some-user-id");
        MockHttpServletResponse response = new MockHttpServletResponse();

        FilterChain throwingChain = (req, res) -> {
            assertThat(CurrentUser.getUserId()).isEqualTo("some-user-id");
            throw new RuntimeException("Downstream error");
        };

        assertThatThrownBy(() -> filter.doFilter(request, response, throwingChain))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("Downstream error");

        // Verify context was still removed in finally block
        assertThat(RequestContextHolder.get()).isNull();
    }
}
