package com.learnup.identity.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.dto.internal.SignInAccess;
import com.learnup.identity.repository.PasswordResetTokenRepository;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.sql.DriverManager;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Opt-in real Identity HTTP -> real Notification JVM -> JavaMail -> loopback SMTP acceptance.
 * Both applications use migrated disposable PostgreSQL; only Tenant access decisions remain mocked.
 * SMTP acceptance proves neither an external mailbox nor a frontend/browser implementation.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"server.address=127.0.0.1", "server.forward-headers-strategy=none"})
@ActiveProfiles({"test", "postgres-test"})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@EnabledIfEnvironmentVariable(named = "IDENTITY_TEST_RECOVERY_E2E", matches = "true")
@ExtendWith(OutputCaptureExtension.class)
class PasswordRecoveryEmailEndToEndTest {
    private static final String INTERNAL_KEY = "testInternalServiceKeyAtLeast32BytesLong!";
    private static final String ORIGINAL_PASSWORD = "SyntheticRecoveryEmailPassword123!";
    private static final String NEW_PASSWORD = "SyntheticChangedEmailPassword123!";
    private static final String FRONTEND = "http://127.0.0.1:5173";
    private static final Pattern RECOVERY_LINK = Pattern.compile(Pattern.quote(FRONTEND) + "/reset-password/([A-Za-z0-9_-]+)");
    private static final Pattern TEST_DATABASE = Pattern.compile(
            "^jdbc:postgresql://127\\.0\\.0\\.1:([0-9]{1,5})/identity_reset_test$");
    private static NotificationFixture notification;

    @LocalServerPort private int identityPort;
    @Autowired private ObjectMapper json;
    @Autowired private JdbcTemplate database;
    @Autowired private PasswordResetTokenRepository resetTokens;
    @MockBean private TenantAccessClient tenantAccessClient;

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3))
            .followRedirects(HttpClient.Redirect.NEVER).build();

    @DynamicPropertySource
    static void disposableInfrastructure(DynamicPropertyRegistry properties) {
        String url = required("IDENTITY_TEST_POSTGRES_URL");
        Matcher target = TEST_DATABASE.matcher(url);
        if (!target.matches()) {
            throw new IllegalStateException("Recovery email tests require the disposable loopback test database");
        }
        int port = Integer.parseInt(target.group(1));
        if (port < 1024 || port > 65535 || port == 5432
                || !"identity_reset_test".equals(required("IDENTITY_TEST_POSTGRES_USERNAME"))
                || required("IDENTITY_TEST_POSTGRES_PASSWORD").length() < 32) {
            throw new IllegalStateException("Recovery email tests require isolated ephemeral PostgreSQL credentials");
        }
        try {
            notification = NotificationFixture.start(url, required("IDENTITY_TEST_POSTGRES_USERNAME"),
                    required("IDENTITY_TEST_POSTGRES_PASSWORD"));
        } catch (Exception failure) {
            // Do not attach child output or exceptions which may include connection/request secrets.
            String diagnostic = failure instanceof FixtureStartupFailure
                    ? failure.getMessage() : "exception_type=" + failure.getClass().getName();
            throw new IllegalStateException("Could not start the isolated Notification/SMTP test fixture; " + diagnostic);
        }
        properties.add("spring.datasource.url", () -> url);
        properties.add("spring.datasource.username", () -> required("IDENTITY_TEST_POSTGRES_USERNAME"));
        properties.add("spring.datasource.password", () -> required("IDENTITY_TEST_POSTGRES_PASSWORD"));
        properties.add("learnup.recovery.notification-base-url", () -> notification.baseUrl);
        properties.add("learnup.recovery.frontend-base-url", () -> FRONTEND);
        properties.add("learnup.recovery.delivery-enabled", () -> true);
        properties.add("learnup.recovery.worker-threads", () -> 1);
        properties.add("learnup.recovery.queue-capacity", () -> 8);
    }

    @BeforeEach
    void allowTenantAccess() throws InterruptedException {
        when(tenantAccessClient.check(any())).thenReturn(new SignInAccess(true, "Full", null));
        while (notification.smtp.awaitMessage(Duration.ZERO) != null) {
            // Drain only the owned receiver's in-memory queue between sequential tests.
        }
    }

    @AfterAll
    static void stopOwnedInfrastructure() {
        if (notification != null) {
            notification.close();
        }
    }

    @Test
    void shouldDeliverAUsableRecoveryLinkThroughRealNotificationAndSmtp(CapturedOutput output) throws Exception {
        Account account = provision();
        Reply originalLogin = identityPost("/api/v1/auth/login",
                Map.of("username", account.email, "password", ORIGINAL_PASSWORD), null);
        assertEquals(200, originalLogin.status);
        String oldRefresh = originalLogin.data.path("refreshToken").asText();
        assertFalse(oldRefresh.isBlank(), "A properly provisioned user must receive a refresh token");

        Reply recovery = forgotWithForgedHost(account.email);
        assertNeutralRecovery(recovery);
        DisposableSmtpReceiver.AcceptedMessage delivered = notification.smtp.awaitMessage(Duration.ofSeconds(20));
        assertNotNull(delivered, "The real SMTP receiver must accept the recovery message");
        assertTrue(delivered.addressedTo(account.email), "SMTP delivery must target the provisioned account");
        String body = delivered.decodedBody();
        assertFalse(body.contains("attacker.invalid"), "Request Host must never choose the recovery origin");
        Matcher link = RECOVERY_LINK.matcher(body);
        assertTrue(link.find(), "The email must include the configured frontend recovery URL");
        String rawToken = link.group(1);
        String hash = sha256(rawToken);
        var persisted = resetTokens.findByTokenHash(hash);
        assertTrue(persisted.isPresent(), "The emailed token must match persisted SHA-256 state");
        assertEquals(account.id, persisted.orElseThrow().getUserId());
        assertTrue(persisted.orElseThrow().getTokenHash().matches("[a-f0-9]{64}"), "Only a SHA-256 hash is persisted");
        assertFalse(recovery.rawBody.contains(rawToken), "The public recovery response must not expose its token");

        String metadata = awaitEmailMetadata(account.email);
        assertFalse(metadata.contains(rawToken), "Notification database metadata must not contain the recovery token");
        assertFalse(metadata.contains(hash), "Notification database metadata must not contain Identity's reset hash");
        Reply logs = request(notification.baseUrl + "/api/v1/notifications/email/logs?recipientEmail="
                + URLEncoder.encode(account.email, StandardCharsets.UTF_8), "GET", null, INTERNAL_KEY);
        assertEquals(200, logs.status);
        assertFalse(logs.rawBody.contains(rawToken), "Notification API metadata must not expose the recovery token");

        Map<String, String> replacement = Map.of("token", rawToken, "newPassword", NEW_PASSWORD, "confirmPassword", NEW_PASSWORD);
        assertEquals(200, identityPost("/api/v1/auth/reset-password", replacement, null).status);
        Reply reused = identityPost("/api/v1/auth/reset-password", replacement, null);
        assertEquals(400, reused.status);
        assertFalse(reused.rawBody.contains(rawToken), "Reset errors must never echo supplied tokens");
        assertEquals(401, identityPost("/api/v1/auth/login",
                Map.of("username", account.email, "password", ORIGINAL_PASSWORD), null).status);
        assertEquals(200, identityPost("/api/v1/auth/login",
                Map.of("username", account.email, "password", NEW_PASSWORD), null).status);
        assertEquals(401, identityPost("/api/v1/auth/refresh", Map.of("refreshToken", oldRefresh), null).status);
        assertFalse(notification.outputContains(rawToken), "The Notification process must not log recovery tokens");
        assertFalse(notification.outputContains(INTERNAL_KEY), "The Notification process must not log service credentials");
        assertFalse(notification.outputContains(ORIGINAL_PASSWORD), "The Notification process must not log passwords");
        assertFalse(output.getAll().contains(rawToken), "Identity logs must not expose recovery tokens");
        assertFalse(output.getAll().contains(hash), "Identity logs must not expose reset hashes");
        assertFalse(output.getAll().contains(INTERNAL_KEY), "Identity logs must not expose internal credentials");
    }

    @Test
    void shouldRequireNotificationServiceAuthenticationAndPreserveTheTenantLegacyAlias() throws Exception {
        String recipient = "legacy-fixture@learnup.test";
        Map<String, String> tenantPayload = Map.of("recipientEmail", recipient, "subject", "Disposable fixture delivery",
                "body", "Synthetic non-sensitive SMTP fixture", "templateCode", "TENANT_INVITATION_FIXTURE");
        Reply rejected = request(notification.baseUrl + "/api/v1/notifications/email/send", "POST", tenantPayload, null);
        assertEquals(403, rejected.status);
        assertNull(notification.smtp.awaitMessage(Duration.ofMillis(500)), "Unauthenticated email must not reach SMTP");

        Reply accepted = request(notification.baseUrl + "/api/notifications/email/send", "POST", tenantPayload, INTERNAL_KEY);
        assertEquals(201, accepted.status);
        assertEquals("SENT", accepted.data.path("status").asText());
        DisposableSmtpReceiver.AcceptedMessage delivered = notification.smtp.awaitMessage(Duration.ofSeconds(10));
        assertNotNull(delivered, "The existing Tenant-shaped email contract must dispatch through real SMTP");
        assertTrue(delivered.addressedTo(recipient), "The legacy alias must retain its recipient contract");
    }

    @Test
    void shouldKeepUnknownEmailNeutralWithoutSendingAMessage() throws Exception {
        long before = resetTokens.count();
        Reply reply = identityPost("/api/auth/forgot-password",
                Map.of("email", "unknown-" + UUID.randomUUID() + "@learnup.test"), null);
        assertNeutralRecovery(reply);
        assertNull(notification.smtp.awaitMessage(Duration.ofSeconds(2)), "Unknown accounts must not receive recovery mail");
        assertEquals(before, resetTokens.count());
    }

    private Account provision() throws Exception {
        UUID id = UUID.randomUUID();
        String email = "recovery-" + id + "@learnup.test";
        Reply provisioned = identityPost("/api/internal/credentials", Map.of("userId", id.toString(),
                "username", "mail_" + id, "email", email, "password", ORIGINAL_PASSWORD, "role", "LEARNER"), INTERNAL_KEY);
        assertEquals(200, provisioned.status);
        return new Account(id, email);
    }

    private Reply identityPost(String path, Map<String, String> payload, String key) throws Exception {
        return request("http://127.0.0.1:" + identityPort + path, "POST", payload, key);
    }

    private Reply request(String url, String method, Map<String, String> payload, String key) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(20))
                .header("X-Correlation-ID", UUID.randomUUID().toString());
        if (key != null) {
            builder.header("X-Internal-Key", key);
        }
        if (payload == null) {
            builder.GET();
        } else {
            builder.header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(json.writeValueAsString(payload)));
        }
        HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        JsonNode envelope = json.readTree(response.body());
        return new Reply(response.statusCode(), envelope.path("data"), response.body());
    }

    private Reply forgotWithForgedHost(String email) throws Exception {
        byte[] payload = json.writeValueAsBytes(Map.of("email", email));
        try (Socket socket = new Socket("127.0.0.1", identityPort)) {
            socket.setSoTimeout(10_000);
            String headers = "POST /api/v1/auth/forgot-password HTTP/1.1\r\nHost: attacker.invalid\r\n"
                    + "X-Forwarded-Host: attacker.invalid\r\nContent-Type: application/json\r\nConnection: close\r\n"
                    + "Content-Length: " + payload.length + "\r\n\r\n";
            socket.getOutputStream().write(headers.getBytes(StandardCharsets.US_ASCII));
            socket.getOutputStream().write(payload);
            socket.getOutputStream().flush();
            String response = new String(socket.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            String[] sections = response.split("\r\n\r\n", 2);
            if (sections.length != 2) {
                throw new IllegalStateException("The loopback Identity response was incomplete");
            }
            int status = Integer.parseInt(sections[0].split(" ", 3)[1]);
            // Servlet JSON may use chunked transfer coding. Decode without printing response content.
            String body = sections[1];
            if (sections[0].toLowerCase().contains("transfer-encoding: chunked")) {
                body = decodeChunks(body);
            }
            return new Reply(status, json.readTree(body).path("data"), body);
        }
    }

    private static String decodeChunks(String encoded) {
        StringBuilder result = new StringBuilder();
        int offset = 0;
        while (true) {
            int end = encoded.indexOf("\r\n", offset);
            if (end < 0) {
                throw new IllegalStateException("Incomplete chunked loopback response");
            }
            int length = Integer.parseInt(encoded.substring(offset, end).split(";", 2)[0], 16);
            if (length == 0) {
                return result.toString();
            }
            offset = end + 2;
            result.append(encoded, offset, offset + length);
            offset += length + 2;
        }
    }

    private static void assertNeutralRecovery(Reply reply) {
        assertEquals(200, reply.status);
        assertTrue(reply.data.isObject() && reply.data.size() == 1 && reply.data.path("message").isTextual(),
                "Recovery must expose only its neutral message");
        assertFalse(reply.rawBody.contains("token"), "The neutral response must not contain token fields");
    }

    private String awaitEmailMetadata(String recipient) throws InterruptedException {
        long deadline = System.nanoTime() + Duration.ofSeconds(10).toNanos();
        while (System.nanoTime() < deadline) {
            var rows = database.queryForList("select row_to_json(t)::text from notification_email_test.email_logs t "
                    + "where recipient_email=? and status='SENT'", String.class, recipient);
            if (!rows.isEmpty()) {
                return rows.getFirst();
            }
            Thread.sleep(100);
        }
        throw new AssertionError("Real Notification must persist SENT metadata after SMTP acceptance");
    }

    private static String sha256(String value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    }

    private static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Required disposable recovery test environment is absent: " + name);
        }
        return value;
    }

    private record Account(UUID id, String email) {}

    private record Reply(int status, JsonNode data, String rawBody) {
        @Override public String toString() { return "Reply[status=" + status + ", content redacted]"; }
    }

    private static final class NotificationFixture implements AutoCloseable {
        private final DisposableSmtpReceiver smtp;
        private final Process child;
        private final String baseUrl;
        private final StringBuilder output = new StringBuilder();
        private final Thread shutdown;

        private NotificationFixture(DisposableSmtpReceiver smtp, Process child, String baseUrl) {
            this.smtp = smtp;
            this.child = child;
            this.baseUrl = baseUrl;
            shutdown = new Thread(this::close, "owned-notification-fixture-stop");
            Runtime.getRuntime().addShutdownHook(shutdown);
            Thread.ofPlatform().daemon().name("notification-fixture-output").start(() -> {
                try (var reader = new BufferedReader(new InputStreamReader(child.getInputStream(), StandardCharsets.UTF_8))) {
                    char[] buffer = new char[2048];
                    int count;
                    while ((count = reader.read(buffer)) >= 0) {
                        synchronized (output) {
                            output.append(buffer, 0, count);
                            if (output.length() > 131_072) {
                                output.delete(0, output.length() - 131_072);
                            }
                        }
                    }
                } catch (IOException ignored) {
                    // Child output remains bounded in memory, never echoed or written to a file.
                }
            });
        }

        static NotificationFixture start(String url, String username, String password) throws Exception {
            Path jar = Path.of("..", "notification-service", "target", "notification-service-1.0.0-SNAPSHOT.jar").toAbsolutePath().normalize();
            if (!Files.isRegularFile(jar)) {
                throw new IllegalStateException("Package Notification Service before opting into recovery email tests");
            }
            try (var connection = DriverManager.getConnection(url, username, password);
                 var statement = connection.createStatement()) {
                statement.execute("CREATE SCHEMA IF NOT EXISTS notification_email_test");
            }
            DisposableSmtpReceiver smtp = new DisposableSmtpReceiver();
            NotificationFixture fixture = null;
            try {
                int port;
                try (ServerSocket reservation = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))) {
                    port = reservation.getLocalPort();
                }
                Path java = Path.of(System.getProperty("java.home"), "bin", "java.exe");
                if (!Files.isRegularFile(java)) {
                    java = Path.of(System.getProperty("java.home"), "bin", "java");
                }
                var builder = new ProcessBuilder(java.toString(), "-jar", jar.toString(),
                        "--spring.jpa.properties.hibernate.default_schema=notification_email_test",
                        "--spring.flyway.schemas=notification_email_test",
                        "--spring.flyway.default-schema=notification_email_test").redirectErrorStream(true);
                Map<String, String> environment = builder.environment();
                environment.remove("SPRING_APPLICATION_JSON");
                environment.remove("SPRING_CONFIG_LOCATION");
                environment.remove("SPRING_CONFIG_ADDITIONAL_LOCATION");
                environment.putAll(Map.of("SERVER_ADDRESS", "127.0.0.1", "SERVER_PORT", Integer.toString(port),
                        "SPRING_PROFILES_ACTIVE", "recovery-email-test", "SPRING_DATASOURCE_URL", url + "?currentSchema=notification_email_test",
                        "SPRING_DATASOURCE_USERNAME", username, "SPRING_DATASOURCE_PASSWORD", password,
                        "SPRING_FLYWAY_SCHEMAS", "notification_email_test", "SPRING_FLYWAY_DEFAULT_SCHEMA", "notification_email_test",
                        "SPRING_JPA_PROPERTIES_HIBERNATE_DEFAULT_SCHEMA", "notification_email_test", "INTERNAL_SERVICE_KEY", INTERNAL_KEY));
                environment.putAll(Map.of("EUREKA_CLIENT_ENABLED", "false", "LEARNUP_MAIL_ENABLED", "true",
                        "LEARNUP_MAIL_FROM", "noreply@learnup.test", "SPRING_MAIL_HOST", "127.0.0.1",
                        "SPRING_MAIL_PORT", Integer.toString(smtp.port()), "SPRING_MAIL_SMTP_AUTH", "false",
                        "SPRING_MAIL_SMTP_STARTTLS_ENABLE", "false", "SPRING_MAIL_USERNAME", "", "SPRING_MAIL_PASSWORD", ""));
                fixture = new NotificationFixture(smtp, builder.start(), "http://127.0.0.1:" + port);
                fixture.awaitHealthy();
                return fixture;
            } catch (Exception failure) {
                String diagnostic = "exception_type=" + failure.getClass().getName()
                        + (fixture == null ? " stage=BEFORE_PROCESS_START" : " " + fixture.startupFailureSummary());
                if (fixture == null) {
                    smtp.close();
                } else {
                    fixture.close();
                }
                throw new FixtureStartupFailure(diagnostic);
            }
        }

        private void awaitHealthy() throws Exception {
            HttpClient probe = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(500)).build();
            long deadline = System.nanoTime() + Duration.ofSeconds(60).toNanos();
            while (System.nanoTime() < deadline && child.isAlive()) {
                try {
                    var response = probe.send(HttpRequest.newBuilder(URI.create(baseUrl + "/actuator/health"))
                            .timeout(Duration.ofSeconds(1)).GET().build(), HttpResponse.BodyHandlers.discarding());
                    if (response.statusCode() == 200) {
                        return;
                    }
                } catch (IOException ignored) {
                    // Startup probing is bounded and never renders potentially sensitive child output.
                }
                Thread.sleep(150);
            }
            throw new IllegalStateException("Owned Notification process did not become healthy within its startup deadline");
        }

        boolean outputContains(String secret) {
            synchronized (output) {
                return output.indexOf(secret) >= 0;
            }
        }

        /** Report only fixed categories/class names, never raw child lines or configuration values. */
        private String startupFailureSummary() {
            synchronized (output) {
                String text = output.toString();
                String category = text.contains("Schema-validation: missing table") ? "MISSING_SCHEMA_TABLE"
                        : text.contains("password authentication failed") ? "DATABASE_AUTHENTICATION"
                        : text.contains("Address already in use") || text.contains("already in use") ? "PORT_BINDING"
                        : text.contains("security.internal-key requires") ? "INTERNAL_KEY_CONFIGURATION"
                        : text.contains("Could not resolve placeholder") ? "MISSING_CONFIGURATION"
                        : text.contains("FlywayException") || text.contains("FlywaySqlException") ? "DATABASE_MIGRATION"
                        : "CHILD_STARTUP";
                Matcher types = Pattern.compile("(?m)(?:Caused by: )?((?:[a-zA-Z_$][a-zA-Z0-9_$]*\\.)+"
                        + "[a-zA-Z_$][a-zA-Z0-9_$]*(?:Exception|Error)):").matcher(text);
                String lastType = "unavailable";
                while (types.find()) {
                    lastType = types.group(1);
                }
                return "stage=" + category + " child_exception_type=" + lastType
                        + " child_exit=" + (child.isAlive() ? "RUNNING" : child.exitValue());
            }
        }

        @Override
        public synchronized void close() {
            // This exact Process object was created by this fixture. Never locate/kill processes by a reused PID or name.
            if (child.isAlive()) {
                child.destroy();
                try {
                    if (!child.waitFor(5, TimeUnit.SECONDS)) {
                        child.destroyForcibly();
                        child.waitFor(5, TimeUnit.SECONDS);
                    }
                } catch (InterruptedException failure) {
                    child.destroyForcibly();
                    Thread.currentThread().interrupt();
                }
            }
            try {
                smtp.close();
            } catch (IOException ignored) {
                // Owned socket cleanup only; no broader process or Docker cleanup is attempted here.
            }
            synchronized (output) {
                output.setLength(0);
            }
        }
    }

    private static final class FixtureStartupFailure extends IllegalStateException {
        private FixtureStartupFailure(String safeDiagnostic) {
            super(safeDiagnostic);
        }
    }
}
