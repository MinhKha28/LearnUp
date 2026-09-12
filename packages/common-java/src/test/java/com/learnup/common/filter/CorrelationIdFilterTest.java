package com.learnup.common.filter;

import com.learnup.common.constant.HeaderConstants;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.slf4j.MDC;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CorrelationIdFilterTest {

    private CorrelationIdFilter filter;
    private HttpServletRequest request;
    private HttpServletResponse response;
    private FilterChain filterChain;

    @BeforeEach
    void setUp() {
        this.filter = new CorrelationIdFilter();
        this.request = Mockito.mock(HttpServletRequest.class);
        this.response = Mockito.mock(HttpServletResponse.class);
        this.filterChain = Mockito.mock(FilterChain.class);
    }

    @Test
    @DisplayName("Should preserve existing X-Correlation-ID from request")
    void shouldPreserveExistingCorrelationId() throws ServletException, IOException {
        when(this.request.getHeader(HeaderConstants.X_CORRELATION_ID)).thenReturn("corr-custom-999");

        this.filter.doFilterInternal(this.request, this.response, this.filterChain);

        verify(this.response).setHeader(HeaderConstants.X_CORRELATION_ID, "corr-custom-999");
        verify(this.filterChain).doFilter(this.request, this.response);
        assertThat(MDC.get("correlationId")).isNull(); // Cleaned up in finally
    }

    @Test
    @DisplayName("Should generate new UUID when X-Correlation-ID is missing")
    void shouldGenerateNewCorrelationIdWhenMissing() throws ServletException, IOException {
        when(this.request.getHeader(HeaderConstants.X_CORRELATION_ID)).thenReturn(null);

        this.filter.doFilterInternal(this.request, this.response, this.filterChain);

        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(this.response).setHeader(Mockito.eq(HeaderConstants.X_CORRELATION_ID), captor.capture());

        String generatedId = captor.getValue();
        assertThat(generatedId).isNotBlank();
    }
}
