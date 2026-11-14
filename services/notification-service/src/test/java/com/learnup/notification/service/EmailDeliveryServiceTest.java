package com.learnup.notification.service;

import com.learnup.notification.config.MailProperties;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.entity.EmailLog;
import com.learnup.notification.repository.EmailLogRepository;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.Properties;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailDeliveryServiceTest {

    @Mock
    private EmailLogRepository emailLogRepository;

    @Mock
    private ObjectProvider<JavaMailSender> mailSenderProvider;

    @Mock
    private JavaMailSender javaMailSender;

    private MailProperties mailProperties;
    private EmailDeliveryService emailDeliveryService;

    @BeforeEach
    void setUp() {
        mailProperties = new MailProperties();
        emailDeliveryService = new EmailDeliveryService(emailLogRepository, mailSenderProvider, mailProperties);
    }

    @Test
    @DisplayName("Should record SIMULATED, not SMTP success, when mail sending is disabled")
    void shouldSimulateEmailSendingWhenDisabled() {
        mailProperties.setEnabled(false);

        SendEmailRequest request = new SendEmailRequest(
                "user@example.com",
                "Test Subject",
                "Hello world",
                "TEST_TEMPLATE"
        );

        when(emailLogRepository.save(any(EmailLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EmailLogResponse response = emailDeliveryService.sendEmail(request);

        assertThat(response).isNotNull();
        assertThat(response.getRecipientEmail()).isEqualTo("user@example.com");
        assertThat(response.getSubject()).isEqualTo("Test Subject");
        assertThat(response.getStatus()).isEqualTo("SIMULATED");
        verify(javaMailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    @DisplayName("Should dispatch email through JavaMailSender when mail sending is enabled")
    void shouldDispatchEmailViaSmtpWhenEnabled() {
        mailProperties.setEnabled(true);
        mailProperties.setFrom("support@learnup.com");

        when(mailSenderProvider.getIfAvailable()).thenReturn(javaMailSender);
        when(javaMailSender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        when(emailLogRepository.save(any(EmailLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SendEmailRequest request = new SendEmailRequest(
                "student@learnup.com",
                "Welcome to Course",
                "<p>Welcome to LearnUP platform!</p>",
                "WELCOME"
        );

        EmailLogResponse response = emailDeliveryService.sendEmail(request);

        assertThat(response).isNotNull();
        assertThat(response.getStatus()).isEqualTo("SENT");
        assertThat(response.getRecipientEmail()).isEqualTo("student@learnup.com");

        ArgumentCaptor<MimeMessage> messageCaptor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(javaMailSender, times(1)).send(messageCaptor.capture());
    }

    @Test
    @DisplayName("Should record FAILED status in email_logs when SMTP dispatch throws exception")
    void shouldRecordFailedStatusOnSmtpException() {
        mailProperties.setEnabled(true);

        when(mailSenderProvider.getIfAvailable()).thenReturn(javaMailSender);
        when(javaMailSender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        doThrow(new MailSendException("SMTP connection refused")).when(javaMailSender).send(any(MimeMessage.class));
        when(emailLogRepository.save(any(EmailLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SendEmailRequest request = new SendEmailRequest(
                "error@example.com",
                "Error Test",
                "Body content",
                "ERROR_TEST"
        );

        EmailLogResponse response = emailDeliveryService.sendEmail(request);

        assertThat(response).isNotNull();
        assertThat(response.getStatus()).isEqualTo("FAILED");
        assertThat(response.getErrorMessage()).isEqualTo("SMTP delivery failed");
    }

    @Test
    void enabledMailWithoutSenderIsFailedNotSimulatedOrSent() {
        mailProperties.setEnabled(true);
        when(emailLogRepository.save(any(EmailLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EmailLogResponse response = emailDeliveryService.sendEmail(
                new SendEmailRequest("recipient@example.test", "Subject", "Body", "WELCOME"));

        assertThat(response.getStatus()).isEqualTo("FAILED");
        assertThat(response.getErrorMessage()).isEqualTo("SMTP sender unavailable");
    }

    @Test
    void recoveryBodyIsSentButNeverCopiedIntoPersistedMetadata() throws Exception {
        mailProperties.setEnabled(true);
        when(mailSenderProvider.getIfAvailable()).thenReturn(javaMailSender);
        when(javaMailSender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        when(emailLogRepository.save(any(EmailLog.class))).thenAnswer(invocation -> invocation.getArgument(0));
        String resetLink = "https://frontend.example.test/reset-password?token=synthetic-recovery-token";

        EmailLogResponse response = emailDeliveryService.sendEmail(
                new SendEmailRequest("recipient@example.test", resetLink,
                        String.join(System.lineSeparator(), "Hệ thống nhận được yêu cầu đặt lại mật khẩu cho tài khoản LearnUP của bạn.", "",
                                "Mở liên kết sau để chọn mật khẩu mới:", resetLink, "", "Liên kết chỉ dùng được một lần."),
                        "IDENTITY_PASSWORD_RECOVERY"));

        ArgumentCaptor<MimeMessage> message = ArgumentCaptor.forClass(MimeMessage.class);
        verify(javaMailSender).send(message.capture());
        assertThat(message.getValue().getSubject()).isEqualTo("LearnUP - Đặt lại mật khẩu");
        // set in the card of the e-mails: the link is the button, whole (the wire form wraps long lines)
        assertThat(htmlOf(message.getValue())).contains("href=\"" + resetLink + "\"").contains("Đặt mật khẩu mới");
        assertThat(response.getSubject()).isEqualTo("LearnUP - Đặt lại mật khẩu");
        assertThat(response.getErrorMessage()).isNull();
        assertThat(response.getStatus()).isEqualTo("SENT");
        ArgumentCaptor<EmailLog> metadata = ArgumentCaptor.forClass(EmailLog.class);
        verify(emailLogRepository).save(metadata.capture());
        assertThat(metadata.getValue().getSubject()).doesNotContain("synthetic-recovery-token");
    }

    private String sentMime(String body) throws Exception {
        mailProperties.setEnabled(true);
        when(mailSenderProvider.getIfAvailable()).thenReturn(javaMailSender);
        when(javaMailSender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        when(emailLogRepository.save(any(EmailLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        emailDeliveryService.sendEmail(new SendEmailRequest("a@example.test", "Subject", body, "LOGO_TEST"));

        ArgumentCaptor<MimeMessage> sent = ArgumentCaptor.forClass(MimeMessage.class);
        verify(javaMailSender).send(sent.capture());
        sent.getValue().saveChanges();
        ByteArrayOutputStream raw = new ByteArrayOutputStream();
        sent.getValue().writeTo(raw);
        return raw.toString(StandardCharsets.ISO_8859_1);
    }

    @Test
    @DisplayName("A body that shows cid:learnup-logo gets the logo attached inline")
    void aBodyThatNamesTheLogoGetsItAttachedInline() throws Exception {
        String mime = sentMime("<p><img src=\"cid:learnup-logo\" alt=\"LearnUP\"/></p>");
        assertThat(mime).contains("Content-Type: image/png").contains("Content-ID: <learnup-logo>")
                .contains("Content-Disposition: inline");
    }

    @Test
    @DisplayName("A body that does not name the logo carries no image")
    void aBodyThatDoesNotNameTheLogoCarriesNoImage() throws Exception {
        assertThat(sentMime("<p>Plain mail</p>")).doesNotContain("image/png").doesNotContain("learnup-logo");
    }

    /** The text/html part of what was sent, decoded. */
    private static String htmlOf(MimeMessage message) throws Exception {
        message.saveChanges();
        return htmlIn(message.getContent());
    }

    private static String htmlIn(Object content) throws Exception {
        if (content instanceof String text) return text;
        if (content instanceof jakarta.mail.Multipart multipart) {
            StringBuilder all = new StringBuilder();
            for (int i = 0; i < multipart.getCount(); i++) {
                jakarta.mail.BodyPart part = multipart.getBodyPart(i);
                if (part.isMimeType("text/html") || part.isMimeType("multipart/*")) {
                    all.append(htmlIn(part.getContent()));
                }
            }
            return all.toString();
        }
        return "";
    }

    @Test
    @DisplayName("The plain text of assessment-service (final score, reminder, waiver) is set in the card, with the logo inline")
    void theTextOfAssessmentServiceIsSetInTheCard() throws Exception {
        for (String code : new String[] { "ASSIGNMENT_FINALIZED", "PEER_REVIEW_REMINDER", "PEER_REVIEW_WAIVED" }) {
            org.mockito.Mockito.reset(javaMailSender, emailLogRepository, mailSenderProvider);
            mailProperties.setEnabled(true);
            when(mailSenderProvider.getIfAvailable()).thenReturn(javaMailSender);
            when(javaMailSender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
            when(emailLogRepository.save(any(EmailLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

            emailDeliveryService.sendEmail(new SendEmailRequest("a@example.test", "Sắp đến hạn chấm chéo",
                    String.join("\n", "Xin chào Học viên Mẫu,", "",
                            "Bạn còn 2 bài nộp chưa chấm. Hạn chấm là 14/11/2026 18:15."), code));

            ArgumentCaptor<MimeMessage> sent = ArgumentCaptor.forClass(MimeMessage.class);
            verify(javaMailSender).send(sent.capture());
            String html = htmlOf(sent.getValue());
            assertThat(html).startsWith("<!DOCTYPE html>").contains("Sắp đến hạn chấm chéo").contains("Xin chào Học viên Mẫu,")
                    .contains("Bạn còn 2 bài nộp chưa chấm. Hạn chấm là 14/11/2026 18:15.").contains("cid:learnup-logo");
            ByteArrayOutputStream raw = new ByteArrayOutputStream();
            sent.getValue().writeTo(raw);
            assertThat(raw.toString(StandardCharsets.ISO_8859_1)).contains("Content-ID: <learnup-logo>");
        }
    }

    @Test
    @DisplayName("A kind that is not listed, and a body that already is HTML, go out as they came")
    void otherBodiesAreNotFramed() throws Exception {
        assertThat(sentMime("Plain text of another kind")).doesNotContain("image/png").doesNotContain("DOCTYPE");
        mailProperties.setEnabled(true);
        when(mailSenderProvider.getIfAvailable()).thenReturn(javaMailSender);
        when(javaMailSender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        when(emailLogRepository.save(any(EmailLog.class))).thenAnswer(invocation -> invocation.getArgument(0));
        emailDeliveryService.sendEmail(new SendEmailRequest("a@example.test", "S",
                "<p>Already HTML</p>", "ASSIGNMENT_FINALIZED"));
        ArgumentCaptor<MimeMessage> sent = ArgumentCaptor.forClass(MimeMessage.class);
        verify(javaMailSender, times(2)).send(sent.capture());
        assertThat(htmlOf(sent.getAllValues().get(1))).isEqualTo("<p>Already HTML</p>");
    }
}
