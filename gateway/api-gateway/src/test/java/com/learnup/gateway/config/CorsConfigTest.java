package com.learnup.gateway.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.test.util.ReflectionTestUtils;
import reactor.core.publisher.Mono;

import static org.assertj.core.api.Assertions.assertThat;

class CorsConfigTest {
    private CorsConfig config() {
        CorsConfig config = new CorsConfig();
        ReflectionTestUtils.setField(config, "allowedOriginsConfig", "http://localhost:5173");
        return config;
    }

    @Test
    void exposesEtagOnCrossOriginSettingsResponse() {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest
                .get("http://localhost:8080/api/v1/certificates/signer-settings")
                .header(HttpHeaders.ORIGIN, "http://localhost:5173"));
        config().corsWebFilter().filter(exchange, chain -> {
            chain.getResponse().getHeaders().setETag("\"7\"");
            return Mono.empty();
        }).block();
        assertThat(exchange.getResponse().getHeaders().getAccessControlExposeHeaders())
                .contains("ETag", "X-Correlation-ID", "Content-Disposition");
        assertThat(exchange.getResponse().getHeaders().getETag()).isEqualTo("\"7\"");
        assertThat(exchange.getResponse().getHeaders().getAccessControlAllowOrigin()).isEqualTo("http://localhost:5173");
    }

    @Test
    void exposesRetryAfterOnCrossOriginOverloadResponse() {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest
                .get("http://localhost:8080/api/v1/certificates/00000000-0000-0000-0000-000000000001/pdf")
                .header(HttpHeaders.ORIGIN, "http://localhost:5173"));
        config().corsWebFilter().filter(exchange, chain -> {
            chain.getResponse().getHeaders().set(HttpHeaders.RETRY_AFTER, "1");
            return Mono.empty();
        }).block();
        assertThat(exchange.getResponse().getHeaders().getAccessControlExposeHeaders()).contains("Retry-After");
        assertThat(exchange.getResponse().getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("1");
        assertThat(exchange.getResponse().getHeaders().getAccessControlAllowOrigin()).isEqualTo("http://localhost:5173");
    }

    @Test
    void permitsIfMatchAndMultipartPutPreflight() {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest
                .options("http://localhost:8080/api/v1/certificates/signer-settings")
                .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "PUT")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "authorization,if-match,content-type"));
        config().corsWebFilter().filter(exchange, chain -> Mono.empty()).block();
        assertThat(exchange.getResponse().getHeaders().getAccessControlAllowMethods()).contains(HttpMethod.PUT);
        assertThat(exchange.getResponse().getHeaders().getAccessControlAllowHeaders())
                .contains("authorization", "if-match", "content-type");
        assertThat(exchange.getResponse().getHeaders().getAccessControlAllowCredentials()).isTrue();
    }
}
