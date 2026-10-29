package com.learnup.identity.client;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.read.ListAppender;
import com.learnup.common.context.HeaderConstants;
import com.learnup.identity.exception.TenantUnavailableException;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TenantAccessClientTest {
    private static final String KEY = "syntheticTenantExistencePrivateKeyAtLeast32Bytes!";
    private static final String SENSITIVE_BODY = "synthetic-private-tenant-response";
    private static final UUID USER_ID = UUID.fromString("01990000-0000-7000-8000-000000000001");
    private static final String PATH = "/api/v1/internal/users/" + USER_ID + "/existence";
    private HttpServer server;
    private ExecutorService executor;
    private TenantAccessClient client;
    private Logger httpLogger;
    private Level originalLevel;
    private ListAppender<ILoggingEvent> logs;

    @BeforeEach
    void startStub() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        executor = Executors.newCachedThreadPool();
        server.setExecutor(executor);
        server.start();
        client = new TenantAccessClient("http://127.0.0.1:" + server.getAddress().getPort(), KEY);
        httpLogger = (Logger) LoggerFactory.getLogger("org.springframework.web.client");
        originalLevel = httpLogger.getLevel();
        httpLogger.setLevel(Level.DEBUG);
        logs = new ListAppender<>();
        logs.start();
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).addAppender(logs);
    }

    @AfterEach
    void stopStubAndCheckDiagnostics() {
        server.stop(0);
        executor.shutdownNow();
        httpLogger.setLevel(originalLevel);
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).detachAppender(logs);
        String diagnostics = logs.list.stream().map(event -> event.getFormattedMessage()
                        + (event.getThrowableProxy() == null ? "" : ThrowableProxyUtil.asString(event.getThrowableProxy())))
                .reduce("", (left, right) -> left + "\n" + right);
        assertThat(diagnostics).doesNotContain(KEY, SENSITIVE_BODY);
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void usesAuthenticatedCanonicalIdLookupAndRequiresAnActualBoolean(boolean exists) {
        AtomicReference<com.sun.net.httpserver.Headers> headers = new AtomicReference<>();
        AtomicReference<String> method = new AtomicReference<>();
        server.createContext(PATH, exchange -> {
            headers.set(exchange.getRequestHeaders());
            method.set(exchange.getRequestMethod());
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            respond(exchange, 200, envelope(Boolean.toString(exists)));
        });

        assertThat(client.exists(USER_ID)).isEqualTo(exists);
        assertThat(method.get()).isEqualTo("GET");
        assertThat(headers.get().getFirst(HeaderConstants.X_INTERNAL_KEY)).isEqualTo(KEY);
        for (String forbidden : new String[]{"Authorization", "X-User-ID", "X-User-Role", "X-Organization-ID"}) {
            assertThat(headers.get().getFirst(forbidden)).isNull();
        }
    }

    @ParameterizedTest
    @MethodSource("invalidBodies")
    void rejectsMissingCoercedAmbiguousAndMalformedBodies(String body) {
        server.createContext(PATH, exchange -> respond(exchange, 200, body));
        assertUnavailable();
    }

    private static Stream<String> invalidBodies() {
        return Stream.of("", "{}", "null", "[]", "false", SENSITIVE_BODY,
                "{\"data\":{\"exists\":false}}",
                "{\"statusCode\":200,\"message\":\"User existence checked\"}",
                "{\"statusCode\":200,\"message\":\"User existence checked\",\"data\":null}",
                "{\"statusCode\":200,\"message\":\"User existence checked\",\"data\":[]}",
                "{\"statusCode\":200,\"message\":\"User existence checked\",\"data\":false}",
                "{\"statusCode\":200,\"message\":\"User existence checked\",\"data\":{}}",
                envelope("null"), envelope("\"false\""), envelope("0"), envelope("1"),
                envelope("[]"), envelope("{}"),
                envelope("false").replace("false}", "false,\"allowed\":false}"),
                envelope("false").replace("false}", "true,\"exists\":false}"),
                envelope("false").replace("\"data\":", "\"data\":{},\"data\":"),
                envelope("false").replace("\"statusCode\":200", "\"statusCode\":503,\"statusCode\":200"),
                envelope("false").replace("200", "201"),
                envelope("false").replace("200", "\"200\""),
                envelope("false").replace("200", "200.0"),
                envelope("false").replace("200", "4294967496"),
                envelope("false").replace("\"statusCode\":200,", ""),
                envelope("false").replace("\"User existence checked\"", "null"),
                envelope("false").replace("\"User existence checked\"", "200"),
                envelope("false").replace("\"message\":\"User existence checked\",", ""),
                envelope("false").replace("\"statusCode\":200", "\"statusCode\":200,\"exists\":false"),
                envelope("false") + " {}",
                envelope("false").substring(0, envelope("false").length() - 1));
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void rejectsTheFormerRawContract(boolean exists) {
        server.createContext(PATH, exchange -> respond(exchange, 200, "{\"exists\":" + exists + "}"));
        assertUnavailable();
    }

    @ParameterizedTest
    @ValueSource(ints = {201, 202, 204, 400, 401, 403, 404, 409, 429, 500, 503, 504})
    void failsClosedOnEveryUnexpectedStatusWithoutRetryOrBodyDisclosure(int status) {
        AtomicInteger calls = new AtomicInteger();
        server.createContext(PATH, exchange -> {
            calls.incrementAndGet();
            respond(exchange, status, SENSITIVE_BODY);
        });
        assertUnavailable();
        assertThat(calls.get()).isOne();
    }

    @Test
    void acceptsExactlyOneKiBButRejectsAnOversizedEnvelope() {
        String body = envelope("false");
        String maximum = body + " ".repeat(1024 - body.getBytes(StandardCharsets.UTF_8).length);
        server.createContext(PATH, exchange -> respond(exchange, 200, maximum));
        assertThat(client.exists(USER_ID)).isFalse();
        server.removeContext(PATH);
        server.createContext(PATH, exchange -> respond(exchange, 200,
                maximum + " "));
        assertUnavailable();
    }

    @ParameterizedTest
    @ValueSource(strings = {"text/plain", "text/html", "application/jsonp", "application/*", "*/*", ""})
    void rejectsNonJsonOrMissingContentTypesEvenWithAValidEnvelope(String contentType) {
        server.createContext(PATH, exchange -> {
            if (!contentType.isEmpty()) {
                exchange.getResponseHeaders().set("Content-Type", contentType);
            }
            byte[] body = envelope("false").getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        assertUnavailable();
    }

    @ParameterizedTest
    @ValueSource(ints = {301, 302, 303, 307, 308})
    void doesNotFollowRedirectsOrForwardTheServiceKey(int status) {
        AtomicInteger targetCalls = new AtomicInteger();
        server.createContext("/redirect-target", exchange -> {
            targetCalls.incrementAndGet();
            respond(exchange, 200, envelope("false"));
        });
        server.createContext(PATH, exchange -> {
            exchange.getResponseHeaders().set("Location", "/redirect-target");
            respond(exchange, status, "");
        });
        assertUnavailable();
        assertThat(targetCalls.get()).isZero();
    }

    @Test
    void failsClosedOnAReadTimeoutWithinTheExistingBound() {
        server.createContext(PATH, exchange -> {
            try {
                Thread.sleep(5000);
                respond(exchange, 200, envelope("false"));
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            } finally {
                exchange.close();
            }
        });
        Instant started = Instant.now();
        assertUnavailable();
        assertThat(Duration.between(started, Instant.now())).isBetween(Duration.ofSeconds(2), Duration.ofSeconds(5));
    }

    @Test
    void failsClosedOnConnectionFailure() {
        server.stop(0);
        assertUnavailable();
    }

    @Test
    void preservesTheSeparateSignInEligibilityContract() {
        server.createContext("/api/v1/internal/users/" + USER_ID + "/sign-in-access", exchange ->
                respond(exchange, 200, "{\"data\":{\"allowed\":false,\"reason\":\"ACCOUNT_DISABLED\"}}"));
        assertThat(client.check(USER_ID).allowed()).isFalse();
        assertThat(client.check(USER_ID).reason()).isEqualTo("ACCOUNT_DISABLED");
    }

    private void assertUnavailable() {
        assertThatThrownBy(() -> client.exists(USER_ID)).isInstanceOf(TenantUnavailableException.class)
                .hasMessage("Account status service is temporarily unavailable").hasNoCause();
    }

    private static String envelope(String exists) {
        return "{\"statusCode\":200,\"message\":\"User existence checked\",\"data\":{\"exists\":" + exists + "}}";
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        if (!exchange.getResponseHeaders().containsKey("Content-Type")) {
            exchange.getResponseHeaders().set("Content-Type", "application/json");
        }
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, status == 204 || bytes.length == 0 ? -1 : bytes.length);
        if (status != 204 && bytes.length != 0) {
            exchange.getResponseBody().write(bytes);
        }
        exchange.close();
    }
}
