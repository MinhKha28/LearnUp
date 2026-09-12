package com.learnup.common.filter;

import com.learnup.common.auth.CurrentUser;
import com.learnup.common.constant.HeaderConstants;
import com.learnup.common.context.SecurityContextHolder;
import com.learnup.common.context.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TenantSecurityFilterTest {

    private TenantSecurityFilter filter;
    private HttpServletRequest request;
    private HttpServletResponse response;
    private FilterChain filterChain;

    @BeforeEach
    void setUp() {
        this.filter = new TenantSecurityFilter();
        this.request = Mockito.mock(HttpServletRequest.class);
        this.response = Mockito.mock(HttpServletResponse.class);
        this.filterChain = Mockito.mock(FilterChain.class);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    @Test
    @DisplayName("Should extract headers and populate SecurityContextHolder and TenantContext during request execution")
    void shouldExtractHeadersAndPopulateContext() throws ServletException, IOException {
        when(this.request.getHeader(HeaderConstants.X_USER_ID)).thenReturn("usr_456");
        when(this.request.getHeader(HeaderConstants.X_ORGANIZATION_ID)).thenReturn("org_789");
        when(this.request.getHeader(HeaderConstants.X_CORRELATION_ID)).thenReturn("corr_123");

        doAnswer(invocation -> {
            CurrentUser user = SecurityContextHolder.getCurrentUser();
            assertThat(user).isNotNull();
            assertThat(user.getUserId()).isEqualTo("usr_456");
            assertThat(user.getOrganizationId()).isEqualTo("org_789");
            assertThat(TenantContext.getOrganizationId()).isEqualTo("org_789");
            return null;
        }).when(this.filterChain).doFilter(this.request, this.response);

        this.filter.doFilterInternal(this.request, this.response, this.filterChain);

        verify(this.filterChain).doFilter(this.request, this.response);
        assertThat(SecurityContextHolder.getCurrentUser()).isNull(); // Cleared in finally
        assertThat(TenantContext.getOrganizationId()).isNull();
    }
}
