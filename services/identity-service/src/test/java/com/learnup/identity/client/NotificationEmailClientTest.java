package com.learnup.identity.client;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.HeaderConstants;
import com.learnup.identity.config.PasswordRecoveryProperties;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static com.learnup.identity.client.NotificationEmailClient.DeliveryResult;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NotificationEmailClientTest {

    private static final String INTERNAL_KEY = "syntheticNotificationClientPrivateKeyAtLeast32Bytes!";
    private static final String RAW_TOKEN = "synthetic-recovery-link-secret";
    private static final String RECOVERY_URL = "https://learnup.example/reset-password/" + RAW_TOKEN;
    private static final String RECIPIENT = "synthetic-recipient@identity-contract.invalid";
    private static final Instant EXPIRY = Instant.parse("2035-01-01T00:15:00Z");
    private static final String ENDPOINT = "/api/v1/notifications/email/send";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private HttpServer server;
    private ExecutorService serverExecutor;
    private PasswordRecoveryProperties properties;
    private Logger rootLogger;
    private Logger httpLogger;
    private Level originalHttpLevel;
    private ListAppender<ILoggingEvent> logs;

    @BeforeEach
    void startPrivateHttpStubAndCaptureLogs() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        serverExecutor = Executors.newCachedThreadPool(task -> {
            Thread thread = new Thread(task, "notification-client-contract");
            thread.setDaemon(true);
            return thread;
        });
        server.setExecutor(serverExecutor);
        server.start();
        properties = new PasswordRecoveryProperties();
        properties.setNotificationBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
        properties.setFrontendBaseUrl("https://learnup.example");
        rootLogger = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
        httpLogger = (Logger) LoggerFactory.getLogger("org.springframework.web.client");
        originalHttpLevel = httpLogger.getLevel();
        httpLogger.setLevel(Level.DEBUG);
        logs = new ListAppender<>();
        logs.start();
        rootLogger.addAppender(logs);
    }

    @AfterEach
    void stopStubAndVerifySecretSafeDiagnostics() {
        server.stop(0);
        serverExecutor.shutdownNow();
        rootLogger.detachAppender(logs);
        httpLogger.setLevel(originalHttpLevel);
        String diagnostics = logs.list.stream().map(event -> event.getFormattedMessage()
                        + (event.getThrowableProxy() == null ? "" : ThrowableProxyUtil.asString(event.getThrowableProxy())))
                .reduce("", (left, right) -> left + "\n" + right);
        assertThat(diagnostics).doesNotContain(INTERNAL_KEY, RAW_TOKEN, RECOVERY_URL, RECIPIENT, "synthetic-response-secret");
    }

    @Test
    void sendsTheExistingNotificationContractWithOnlyPrivateServiceAndSafeCorrelationHeaders() throws Exception {
        AtomicReference<JsonNode> capturedBody = new AtomicReference<>();
        AtomicReference<com.sun.net.httpserver.Headers> capturedHeaders = new AtomicReference<>();
        AtomicReference<String> capturedMethod = new AtomicReference<>();
        server.createContext(ENDPOINT, exchange -> {
            capturedMethod.set(exchange.getRequestMethod());
            capturedHeaders.set(exchange.getRequestHeaders());
            capturedBody.set(objectMapper.readTree(exchange.getRequestBody()));
            respond(exchange, 201, "{\"success\":true,\"data\":{\"status\":\"SENT\"}}");
        });
        String correlationId = UUID.randomUUID().toString();

        DeliveryResult result = client().sendRecovery(RECIPIENT, RECOVERY_URL, EXPIRY, correlationId);

        assertThat(result).isEqualTo(DeliveryResult.SENT);
        assertThat(capturedMethod.get()).isEqualTo("POST");
        assertThat(capturedHeaders.get().getFirst(HeaderConstants.X_INTERNAL_KEY)).isEqualTo(INTERNAL_KEY);
        assertThat(capturedHeaders.get().getFirst(HeaderConstants.X_CORRELATION_ID)).isEqualTo(correlationId);
        for (String forbidden : new String[] {"Authorization", "X-User-ID", "X-Organization-ID", "X-User-Role"}) {
            assertThat(capturedHeaders.get().getFirst(forbidden)).isNull();
        }
        JsonNode body = capturedBody.get();
        assertThat(body.size()).isEqualTo(4);
        assertThat(body.path("recipientEmail").asText()).isEqualTo(RECIPIENT);
        assertThat(body.path("subject").asText()).isEqualTo("LearnUP password recovery");
        assertThat(body.path("templateCode").asText()).isEqualTo("IDENTITY_PASSWORD_RECOVERY");
        assertThat(body.path("body").asText()).contains(RECOVERY_URL, "2035-01-01T00:15:00Z", "UTC", "only once", "newest");
    }

    @ParameterizedTest
    @CsvSource({"SENT,SENT", "SIMULATED,SIMULATED", "FAILED,FAILED", "UNKNOWN,INVALID_RESPONSE"})
    void interpretsActualDeliveryStatusInsteadOfTreatingEveryCreatedResponseAsSent(String status, DeliveryResult expected) {
        server.createContext(ENDPOINT, exchange -> respond(exchange, 201,
                "{\"success\":true,\"data\":{\"status\":\"" + status + "\"}}"));
        assertThat(send()).isEqualTo(expected);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "{}", "{\"success\":false,\"data\":{\"status\":\"SENT\"}}",
            "{\"success\":true}", "{\"success\":true,\"data\":{}}", "synthetic-response-secret"})
    void rejectsMissingOrMalformedSuccessEnvelopesWithoutEchoingThem(String responseBody) {
        server.createContext(ENDPOINT, exchange -> respond(exchange, 201, responseBody));
        assertThat(send()).isEqualTo(DeliveryResult.INVALID_RESPONSE);
    }

    @ParameterizedTest
    @CsvSource({"200,INVALID_RESPONSE", "400,INVALID_RESPONSE", "401,UNAUTHORIZED", "403,UNAUTHORIZED",
            "408,TIMEOUT", "429,UNAVAILABLE", "500,UNAVAILABLE", "503,UNAVAILABLE", "504,TIMEOUT"})
    void sanitizesHttpFailuresAndDoesNotRetry(int status, DeliveryResult expected) {
        AtomicInteger requests = new AtomicInteger();
        server.createContext(ENDPOINT, exchange -> {
            requests.incrementAndGet();
            respond(exchange, status, "{\"success\":false,\"message\":\"synthetic-response-secret\"}");
        });
        assertThat(send()).isEqualTo(expected);
        assertThat(requests.get()).isEqualTo(1);
    }

    @ParameterizedTest
    @ValueSource(ints = {301, 302, 303, 307, 308})
    void neverFollowsRedirectsOrForwardsThePrivateKeyAndBody(int redirectStatus) {
        AtomicInteger redirectedRequests = new AtomicInteger();
        server.createContext("/untrusted-redirect-target", exchange -> {
            redirectedRequests.incrementAndGet();
            respond(exchange, 201, "{\"success\":true,\"data\":{\"status\":\"SENT\"}}");
        });
        server.createContext(ENDPOINT, exchange -> {
            exchange.getResponseHeaders().add("Location", properties.getNotificationBaseUrl() + "/untrusted-redirect-target");
            respond(exchange, redirectStatus, "{}");
        });
        assertThat(send()).isEqualTo(DeliveryResult.INVALID_RESPONSE);
        assertThat(redirectedRequests.get()).isZero();
    }

    @Test
    void readTimeoutIsBoundedAndDoesNotRetry() {
        properties.setReadTimeoutMillis(100);
        AtomicInteger requests = new AtomicInteger();
        server.createContext(ENDPOINT, exchange -> {
            requests.incrementAndGet();
            try {
                Thread.sleep(400);
                respond(exchange, 201, "{\"success\":true,\"data\":{\"status\":\"SENT\"}}");
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                exchange.close();
            } catch (IOException disconnected) {
                exchange.close();
            }
        });
        Instant started = Instant.now();
        assertThat(send()).isEqualTo(DeliveryResult.TIMEOUT);
        assertThat(Duration.between(started, Instant.now())).isLessThan(Duration.ofSeconds(2));
        assertThat(requests.get()).isEqualTo(1);
    }

    @Test
    void timeoutWhileReadingAnAlreadyStartedJsonBodyIsNotMisclassifiedAsMalformedJson() {
        properties.setReadTimeoutMillis(100);
        AtomicInteger requests = new AtomicInteger();
        byte[] prefix = "{\"success\":true,".getBytes(StandardCharsets.UTF_8);
        byte[] suffix = "\"data\":{\"status\":\"SENT\"}}".getBytes(StandardCharsets.UTF_8);
        server.createContext(ENDPOINT, exchange -> {
            requests.incrementAndGet();
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(201, prefix.length + suffix.length);
            try {
                exchange.getResponseBody().write(prefix);
                exchange.getResponseBody().flush();
                Thread.sleep(400);
                exchange.getResponseBody().write(suffix);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            } catch (IOException disconnected) {
                // The timed-out client has already closed this test connection.
            } finally {
                exchange.close();
            }
        });

        Instant started = Instant.now();
        assertThat(send()).isEqualTo(DeliveryResult.TIMEOUT);
        assertThat(Duration.between(started, Instant.now())).isLessThan(Duration.ofSeconds(2));
        assertThat(requests.get()).isEqualTo(1);
    }

    @Test
    void unreachableNotificationIsReportedWithoutThrowingOrLoggingTransportDetails() {
        int closedPort = server.getAddress().getPort();
        server.stop(0);
        properties.setNotificationBaseUrl("http://127.0.0.1:" + closedPort);
        assertThat(send()).isEqualTo(DeliveryResult.UNAVAILABLE);
    }

    @Test
    void callerSuppliedNonUuidCorrelationValuesAreNeverForwardedOrLogged() {
        AtomicReference<String> correlation = new AtomicReference<>();
        server.createContext(ENDPOINT, exchange -> {
            correlation.set(exchange.getRequestHeaders().getFirst(HeaderConstants.X_CORRELATION_ID));
            respond(exchange, 201, "{\"success\":true,\"data\":{\"status\":\"SIMULATED\"}}");
        });
        assertThat(client().sendRecovery(RECIPIENT, RECOVERY_URL, EXPIRY, RAW_TOKEN)).isEqualTo(DeliveryResult.SIMULATED);
        assertThat(UUID.fromString(correlation.get()).toString()).isEqualTo(correlation.get());
        assertThat(correlation.get()).isNotEqualTo(RAW_TOKEN);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "short", "learnup-internal-secret"})
    void refusesMissingWeakOrRepositoryDefaultServiceKeys(String key) {
        assertThatThrownBy(() -> new NotificationEmailClient(properties, key))
                .isInstanceOf(IllegalStateException.class).hasMessageNotContaining("learnup-internal-secret");
    }

    @Test
    void refusesAbsentServiceKey() {
        assertThatThrownBy(() -> new NotificationEmailClient(properties, null)).isInstanceOf(IllegalStateException.class);
    }

    private NotificationEmailClient client() {
        return new NotificationEmailClient(properties, INTERNAL_KEY);
    }

    private DeliveryResult send() {
        return client().sendRecovery(RECIPIENT, RECOVERY_URL, EXPIRY, UUID.randomUUID().toString());
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] payload = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, payload.length == 0 ? -1 : payload.length);
        if (payload.length > 0) {
            exchange.getResponseBody().write(payload);
        }
        exchange.close();
    }
}
