package com.learnup.notification.controller;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.notification.config.MailProperties;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.entity.EmailLog;
import com.learnup.notification.repository.EmailLogRepository;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.Properties;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "management.health.mail.enabled=false")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EmailDeliverySecurityIntegrationTest {
    private static final String KEY = "notification-test-only-internal-key-32bytes";
    private static final String SECRET = "synthetic-reset-secret-not-for-deployment";
    private static final String LINK = "https://local.example/reset-password?token=" + SECRET;

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper mapper;
    @Autowired private MailProperties mailProperties;
    @SpyBean private EmailLogRepository emailLogs;
    @MockBean private JavaMailSender sender;

    private final Logger root = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
    private ListAppender<ILoggingEvent> captured;

    @BeforeEach
    void setUp() {
        emailLogs.deleteAll();
        mailProperties.setEnabled(false);
        captured = new ListAppender<>();
        captured.start();
        root.addAppender(captured);
    }

    @AfterEach
    void tearDown() {
        root.detachAppender(captured);
        captured.stop();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/notifications/email", "/api/notifications/email"})
    void bothAliasesRejectMissingOrInvalidKeysWithoutPersistence(String path) throws Exception {
        for (String supplied : new String[]{"", SECRET, "learnup-internal-secret"}) {
            String body = mvc.perform(post(path + "/send")
                            .header("X-Internal-Key", supplied)
                            .header("X-Correlation-ID", SECRET)
                            .contentType(MediaType.APPLICATION_JSON).content(request()))
                    .andExpect(status().isForbidden()).andReturn().getResponse().getContentAsString();
            assertThat(body).doesNotContain(SECRET, LINK, KEY);
            mvc.perform(get(path + "/logs").header("X-Internal-Key", supplied))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(post(path + "/send").contentType(MediaType.APPLICATION_JSON).content(request()))
                .andExpect(status().isForbidden());
        mvc.perform(get(path + "/logs")).andExpect(status().isForbidden());
        assertThat(emailLogs.count()).isZero();
        assertSafeLogs();
    }

    @Test
    void normalizedMatrixParameterRouteCannotBypassServiceAuthentication() throws Exception {
        mvc.perform(post("/api/v1/notifications/email;attempt/send")
                        .contentType(MediaType.APPLICATION_JSON).content(request()))
                .andExpect(status().isForbidden());
        assertThat(emailLogs.count()).isZero();
        assertSafeLogs();
    }

    @ParameterizedTest
    @ValueSource(strings = {"X-User-ID", "X-Organization-ID", "X-User-Role", "Authorization"})
    void validServiceKeyDoesNotAcceptUserIdentityHeaders(String header) throws Exception {
        mvc.perform(post("/api/v1/notifications/email/send")
                        .header("X-Internal-Key", KEY).header(header, SECRET)
                        .contentType(MediaType.APPLICATION_JSON).content(request()))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/notifications/email/logs")
                        .header("X-Internal-Key", KEY).header(header, SECRET))
                .andExpect(status().isForbidden());
        assertThat(emailLogs.count()).isZero();
        assertSafeLogs();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/notifications/email", "/api/notifications/email"})
    void authenticatedRecoveryDeliveryNeverRetainsLinkInMetadata(String path) throws Exception {
        String correlationId = UUID.randomUUID().toString();
        var response = mvc.perform(post(path + "/send")
                        .header("X-Internal-Key", KEY).header("X-Correlation-ID", correlationId)
                        .contentType(MediaType.APPLICATION_JSON).content(request()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("SIMULATED"))
                .andExpect(jsonPath("$.data.subject").value("LearnUP password recovery"))
                .andReturn().getResponse();
        assertThat(response.getHeader("X-Correlation-ID")).isEqualTo(correlationId);
        assertThat(response.getContentAsString()).doesNotContain(SECRET, LINK, KEY);
        assertThat(emailLogs.findAll()).singleElement().satisfies(log -> {
            assertThat(log.getSubject()).isEqualTo("LearnUP password recovery");
            assertThat(log.getStatus()).isEqualTo("SIMULATED");
            assertThat(log.getErrorMessage()).isNull();
        });
        String logs = mvc.perform(get(path + "/logs").header("X-Internal-Key", KEY))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(logs).doesNotContain(SECRET, LINK, KEY);
        assertThat(logText()).contains(correlationId, "status=SIMULATED");
        assertSafeLogs();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"recipientEmail\":\"synthetic-reset-secret-not-for-deployment\"}",
            "{\"recipientEmail\":{\"sensitive\":\"synthetic-reset-secret-not-for-deployment\"}}",
            "{\"body\":\"synthetic-reset-secret-not-for-deployment\""})
    void validationAndMalformedJsonNeverEchoSecretValues(String body) throws Exception {
        String response = mvc.perform(post("/api/v1/notifications/email/send")
                        .header("X-Internal-Key", KEY).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain(SECRET, KEY);
        assertThat(emailLogs.count()).isZero();
        assertSafeLogs();
    }

    @Test
    void smtpFailureInsideCreatedResponseIsFailedAndSanitized() throws Exception {
        mailProperties.setEnabled(true);
        when(sender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        doThrow(new MailSendException("SMTP rejected sensitive content " + LINK, new Exception(KEY)))
                .when(sender).send(any(MimeMessage.class));
        String response = mvc.perform(post("/api/v1/notifications/email/send")
                        .header("X-Internal-Key", KEY).contentType(MediaType.APPLICATION_JSON).content(request()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("FAILED"))
                .andExpect(jsonPath("$.data.errorMessage").value("SMTP delivery failed"))
                .andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain(SECRET, LINK, KEY);
        assertThat(emailLogs.findAll()).singleElement().extracting(EmailLog::getErrorMessage)
                .isEqualTo("SMTP delivery failed");
        assertThat(logText()).contains("SMTP_FAILURE", "MailSendException");
        assertSafeLogs();
    }

    @Test
    void unexpectedPersistenceExceptionDoesNotEchoSensitiveMessageOrCause() throws Exception {
        doThrow(new IllegalStateException(SECRET, new RuntimeException(KEY)))
                .when(emailLogs).save(any(EmailLog.class));
        String response = mvc.perform(post("/api/v1/notifications/email/send")
                        .header("X-Internal-Key", KEY).contentType(MediaType.APPLICATION_JSON).content(request()))
                .andExpect(status().isInternalServerError()).andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain(SECRET, LINK, KEY);
        assertThat(logText()).contains("event=email_request_failed", "InvalidDataAccessApiUsageException");
        assertSafeLogs();
    }

    private String request() throws Exception {
        return mapper.writeValueAsString(new SendEmailRequest("recipient@example.test", LINK,
                "Reset your password using " + LINK + ". Expires in 15 minutes.", "IDENTITY_PASSWORD_RECOVERY"));
    }

    private String logText() {
        return captured.list.stream().map(event -> event.getFormattedMessage() + " "
                + Arrays.toString(event.getArgumentArray()) + " "
                + (event.getThrowableProxy() == null ? "" : ThrowableProxyUtil.asString(event.getThrowableProxy())))
                .collect(Collectors.joining("\n"));
    }

    private void assertSafeLogs() {
        assertThat(logText()).doesNotContain(SECRET, LINK, KEY, "recipient@example.test");
    }
}
