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
    @DisplayName("Should record SENT log in simulated mode when mail sending is disabled")
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
        assertThat(response.getStatus()).isEqualTo("SENT");
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
        assertThat(response.getErrorMessage()).contains("SMTP connection refused");
    }
}
