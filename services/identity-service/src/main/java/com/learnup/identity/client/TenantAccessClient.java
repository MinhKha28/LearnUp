package com.learnup.identity.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.HeaderConstants;
import com.learnup.identity.dto.internal.SignInAccess;
import com.learnup.identity.exception.TenantUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.time.Duration;
import java.util.UUID;

@Component
public class TenantAccessClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(3);
    private static final int MAX_EXISTENCE_BODY_BYTES = 1024;
    private static final ObjectMapper EXISTENCE_JSON = new ObjectMapper()
            .enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);

    private final RestClient restClient;

    public TenantAccessClient(@Value("${tenant.service-url}") String baseUrl,
                              @Value("${security.internal-key}") String internalKey) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory() {
            @Override
            protected void prepareConnection(HttpURLConnection connection, String method) throws IOException {
                super.prepareConnection(connection, method);
                // Never forward the private service credential to a redirect target.
                connection.setInstanceFollowRedirects(false);
            }
        };
        requestFactory.setConnectTimeout(TIMEOUT);
        requestFactory.setReadTimeout(TIMEOUT);
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .defaultHeader(HeaderConstants.X_INTERNAL_KEY, internalKey)
                .build();
    }

    public SignInAccess check(UUID userId) {
        TenantEnvelope envelope;
        try {
            envelope = restClient.get()
                    .uri("/api/v1/internal/users/{userId}/sign-in-access", userId)
                    .retrieve()
                    .body(TenantEnvelope.class);
        } catch (RestClientException ex) {
            throw new TenantUnavailableException(ex);
        }
        if (envelope == null || envelope.data() == null) {
            throw new TenantUnavailableException(null);
        }
        return envelope.data();
    }

    /** Existence is independent of sign-in eligibility. Only a strict boolean can authorize reuse. */
    public boolean exists(UUID userId) {
        try {
            return restClient.get()
                    .uri("/api/v1/internal/users/{userId}/existence", userId)
                    .accept(MediaType.APPLICATION_JSON)
                    .exchange((request, response) -> {
                        if (response.getStatusCode().value() != 200
                                || response.getHeaders().getContentType() == null
                                || !MediaType.APPLICATION_JSON.isCompatibleWith(response.getHeaders().getContentType())) {
                            throw new TenantUnavailableException(null);
                        }
                        // Parse directly: message converters/debug logs must never render a Tenant error body.
                        byte[] body = response.getBody().readNBytes(MAX_EXISTENCE_BODY_BYTES + 1);
                        if (body.length > MAX_EXISTENCE_BODY_BYTES) {
                            throw new TenantUnavailableException(null);
                        }
                        JsonNode result = EXISTENCE_JSON.readTree(body);
                        if (result == null || !result.isObject() || result.size() != 1
                                || !result.path("exists").isBoolean()) {
                            throw new TenantUnavailableException(null);
                        }
                        return result.get("exists").booleanValue();
                    });
        } catch (RestClientException | IllegalArgumentException ex) {
            // Conversion/HTTP exceptions can contain arbitrary response content. Do not retain it.
            throw new TenantUnavailableException(null);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TenantEnvelope(SignInAccess data) {
    }
}
