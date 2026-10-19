package com.learnup.notification.service;

import com.learnup.common.response.PageResponse;
import com.learnup.notification.config.MailProperties;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.entity.EmailLog;
import com.learnup.notification.repository.EmailLogRepository;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class EmailDeliveryService {

    private static final Logger log = LoggerFactory.getLogger(EmailDeliveryService.class);
    public static final String RECOVERY_TEMPLATE = "IDENTITY_PASSWORD_RECOVERY";
    public static final String RECOVERY_SUBJECT = "LearnUP password recovery";

    private final EmailLogRepository emailLogRepository;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final MailProperties mailProperties;

    public EmailDeliveryService(EmailLogRepository emailLogRepository,
                                ObjectProvider<JavaMailSender> mailSenderProvider,
                                MailProperties mailProperties) {
        this.emailLogRepository = emailLogRepository;
        this.mailSenderProvider = mailSenderProvider;
        this.mailProperties = mailProperties;
    }

    @Transactional
    public EmailLogResponse sendEmail(SendEmailRequest request) {
        log.info("event=email_dispatch_started correlation_id={}", MDC.get("correlationId"));

        String status = "SIMULATED";
        String errorMessage = null;
        // Never retain a caller-supplied recovery subject, which could contain the reset link.
        String subject = RECOVERY_TEMPLATE.equals(request.getTemplateCode())
                ? RECOVERY_SUBJECT : request.getSubject();

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();

        if (mailProperties.isEnabled() && mailSender != null) {
            try {
                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());

                helper.setFrom(mailProperties.getFrom());
                helper.setTo(request.getRecipientEmail());
                helper.setSubject(subject);

                boolean isHtml = request.getBody() != null && request.getBody().contains("<") && request.getBody().contains(">");
                helper.setText(request.getBody(), isHtml);

                mailSender.send(message);
                status = "SENT";
                log.info("event=email_dispatch_completed status=SENT correlation_id={}", MDC.get("correlationId"));
            } catch (Exception e) {
                log.error("event=email_dispatch_failed reason=SMTP_FAILURE exception_type={} correlation_id={}",
                        e.getClass().getName(), MDC.get("correlationId"));
                status = "FAILED";
                errorMessage = "SMTP delivery failed";
            }
        } else if (mailProperties.isEnabled()) {
            status = "FAILED";
            errorMessage = "SMTP sender unavailable";
            log.error("event=email_dispatch_failed reason=SMTP_SENDER_UNAVAILABLE correlation_id={}", MDC.get("correlationId"));
        } else {
            log.info("event=email_dispatch_completed status=SIMULATED correlation_id={}", MDC.get("correlationId"));
        }

        EmailLog emailLog = new EmailLog(
                UUID.randomUUID(),
                request.getRecipientEmail(),
                subject,
                status,
                errorMessage,
                Instant.now()
        );

        EmailLog saved = emailLogRepository.save(emailLog);
        log.info("event=email_dispatch_recorded email_log_id={} status={} correlation_id={}",
                saved.getId(), saved.getStatus(), MDC.get("correlationId"));

        return EmailLogResponse.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<EmailLogResponse> getEmailLogs(String recipientEmail, Pageable pageable) {
        Page<EmailLog> pageResult;
        if (recipientEmail != null && !recipientEmail.isBlank()) {
            pageResult = emailLogRepository.findByRecipientEmailOrderBySentAtDesc(recipientEmail, pageable);
        } else {
            pageResult = emailLogRepository.findAll(pageable);
        }

        List<EmailLogResponse> items = pageResult.getContent().stream()
                .map(EmailLogResponse::fromEntity)
                .toList();

        return PageResponse.of(items, pageResult.getNumber(), pageResult.getSize(), pageResult.getTotalElements());
    }
}
