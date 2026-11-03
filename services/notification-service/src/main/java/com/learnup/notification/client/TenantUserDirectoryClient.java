package com.learnup.notification.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.learnup.common.context.HeaderConstants;
import com.learnup.notification.enrollment.DependencyUnavailableException;
import com.learnup.notification.enrollment.PermanentDeliveryException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Asks tenant-service who a user is: {@code POST /api/v1/internal/users/display-names} with the internal key and the
 * Organization of the event in {@code x-organization-id} (without it tenant answers 400 ORGANIZATION_REQUIRED).
 */
@Component
public class TenantUserDirectoryClient implements RecipientDirectory {

    private static final ParameterizedTypeReference<Envelope> ENVELOPE = new ParameterizedTypeReference<>() {
    };

    private final RestClient restClient;

    public TenantUserDirectoryClient(@Qualifier("tenantRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    public Optional<Recipient> find(UUID organizationId, UUID userId) {
        Envelope envelope;
        try {
            envelope = restClient.post()
                    .uri("/api/v1/internal/users/display-names")
                    .header(HeaderConstants.X_ORGANIZATION_ID, organizationId.toString())
                    .body(Map.of("userIds", List.of(userId.toString())))
                    .retrieve()
                    .body(ENVELOPE);
        } catch (RestClientResponseException e) {
            throw failure(e.getStatusCode());
        } catch (RestClientException e) {
            throw new DependencyUnavailableException("TENANT_UNAVAILABLE");
        }
        if (envelope == null || envelope.data() == null) {
            throw new DependencyUnavailableException("TENANT_UNAVAILABLE");
        }
        return envelope.data().stream()
                .filter(user -> userId.equals(user.id()))
                .findFirst()
                .map(user -> new Recipient(user.id(), user.fullName(), user.email(), user.status()));
    }

    /** A server error, a throttle or a timeout may pass; any other refusal will not. */
    static RuntimeException failure(HttpStatusCode status) {
        if (status.is5xxServerError() || status.value() == 429 || status.value() == 408) {
            return new DependencyUnavailableException("TENANT_UNAVAILABLE");
        }
        return new PermanentDeliveryException("TENANT_REJECTED");
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Envelope(List<User> data) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record User(UUID id, String fullName, String email, String status) {
    }
}
