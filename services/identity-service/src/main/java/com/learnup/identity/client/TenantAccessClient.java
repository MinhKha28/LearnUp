package com.learnup.identity.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.learnup.common.context.HeaderConstants;
import com.learnup.identity.dto.internal.SignInAccess;
import com.learnup.identity.exception.TenantUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.util.UUID;

@Component
public class TenantAccessClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(3);

    private final RestClient restClient;

    public TenantAccessClient(@Value("${tenant.service-url}") String baseUrl,
                              @Value("${security.internal-key}") String internalKey) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
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

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TenantEnvelope(SignInAccess data) {
    }
}
