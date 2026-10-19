package com.learnup.identity.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.learnup.common.context.HeaderConstants;
import com.learnup.identity.config.PasswordRecoveryProperties;
import com.learnup.identity.security.AuthenticationDiagnostics;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/** Bounded, non-retrying service channel. Transport bodies and exceptions are never logged. */
@Component
public class NotificationEmailClient {

    public enum DeliveryResult { SENT, SIMULATED, FAILED, UNAVAILABLE, TIMEOUT, UNAUTHORIZED, INVALID_RESPONSE }

    private final RestClient restClient;

    public NotificationEmailClient(PasswordRecoveryProperties properties,
                                   @Value("${security.internal-key}") String internalKey) {
        properties.afterPropertiesSet();
        if (internalKey == null || internalKey.isBlank()
                || internalKey.getBytes(StandardCharsets.UTF_8).length < 32
                || "learnup-internal-secret".equals(internalKey.trim())) {
            throw new IllegalStateException("INTERNAL_SERVICE_KEY must be explicitly configured, non-default and at least 32 bytes");
        }
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory() {
            @Override
            protected void prepareConnection(HttpURLConnection connection, String method) throws IOException {
                super.prepareConnection(connection, method);
                // Never forward the service credential or recovery body to a redirect target.
                connection.setInstanceFollowRedirects(false);
            }
        };
        requestFactory.setConnectTimeout(properties.getConnectTimeoutMillis());
        requestFactory.setReadTimeout(properties.getReadTimeoutMillis());
        restClient = RestClient.builder().baseUrl(properties.getNotificationBaseUrl())
                .requestFactory(requestFactory)
                .defaultHeader(HeaderConstants.X_INTERNAL_KEY, internalKey)
                .build();
    }

    public DeliveryResult sendRecovery(String recipientEmail, String recoveryUrl, Instant expiresAt, String correlationId) {
        if (recipientEmail == null || recipientEmail.isBlank() || recoveryUrl == null || recoveryUrl.isBlank() || expiresAt == null) {
            return DeliveryResult.FAILED;
        }
        String safeCorrelationId = AuthenticationDiagnostics.isCorrelationId(correlationId)
                ? correlationId : UUID.randomUUID().toString();
        String body = "A LearnUP password recovery was requested for your account.\n\n"
                + "Open this link to choose a new password:\n" + recoveryUrl + "\n\n"
                + "Expires at " + DateTimeFormatter.ISO_INSTANT.format(expiresAt) + " (UTC).\n"
                + "This link can be used only once. Only the newest recovery link is valid.\n"
                + "If you did not request this change, ignore this email.";
        try {
            ResponseEntity<NotificationEnvelope> response = restClient.post()
                    .uri("/api/v1/notifications/email/send")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header(HeaderConstants.X_CORRELATION_ID, safeCorrelationId)
                    .body(new RecoveryEmail(recipientEmail, "LearnUP password recovery", body, "IDENTITY_PASSWORD_RECOVERY"))
                    .retrieve().toEntity(NotificationEnvelope.class);
            NotificationEnvelope envelope = response.getBody();
            if (response.getStatusCode().value() != HttpStatus.CREATED.value() || envelope == null
                    || !Boolean.TRUE.equals(envelope.getSuccess()) || envelope.getData() == null) {
                return DeliveryResult.INVALID_RESPONSE;
            }
            return switch (envelope.getData().getStatus() == null ? "" : envelope.getData().getStatus()) {
                case "SENT" -> DeliveryResult.SENT;
                case "SIMULATED" -> DeliveryResult.SIMULATED;
                case "FAILED" -> DeliveryResult.FAILED;
                default -> DeliveryResult.INVALID_RESPONSE;
            };
        } catch (RestClientResponseException responseFailure) {
            int status = responseFailure.getStatusCode().value();
            if (status == 401 || status == 403) {
                return DeliveryResult.UNAUTHORIZED;
            }
            if (status == 408 || status == 504) {
                return DeliveryResult.TIMEOUT;
            }
            return status >= 500 || status == 429 ? DeliveryResult.UNAVAILABLE : DeliveryResult.INVALID_RESPONSE;
        } catch (ResourceAccessException transportFailure) {
            return hasTimeoutCause(transportFailure) ? DeliveryResult.TIMEOUT : DeliveryResult.UNAVAILABLE;
        } catch (RestClientException invalidResponse) {
            // RestClient wraps timeouts during status/body extraction as a plain
            // RestClientException (possibly through a JSON conversion exception).
            // Classify the cause, never its potentially secret-bearing message.
            return hasTimeoutCause(invalidResponse) ? DeliveryResult.TIMEOUT : DeliveryResult.INVALID_RESPONSE;
        }
    }

    private static boolean hasTimeoutCause(Throwable failure) {
        // Bound traversal defensively; exception messages/bodies are never rendered.
        for (int depth = 0; failure != null && depth < 20; depth++, failure = failure.getCause()) {
            if (failure instanceof SocketTimeoutException) {
                return true;
            }
        }
        return false;
    }

    // Ordinary DTOs deliberately retain Object.toString(): HTTP debug diagnostics must not
    // render recipient addresses or the secret-bearing recovery body as a record/map string.
    private static final class RecoveryEmail {
        private final String recipientEmail;
        private final String subject;
        private final String body;
        private final String templateCode;

        private RecoveryEmail(String recipientEmail, String subject, String body, String templateCode) {
            this.recipientEmail = recipientEmail;
            this.subject = subject;
            this.body = body;
            this.templateCode = templateCode;
        }

        public String getRecipientEmail() { return recipientEmail; }
        public String getSubject() { return subject; }
        public String getBody() { return body; }
        public String getTemplateCode() { return templateCode; }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static final class NotificationEnvelope {
        private Boolean success;
        private NotificationData data;
        public Boolean getSuccess() { return success; }
        public void setSuccess(Boolean success) { this.success = success; }
        public NotificationData getData() { return data; }
        public void setData(NotificationData data) { this.data = data; }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static final class NotificationData {
        private String status;
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }
}
