package com.learnup.notification.service;

import com.learnup.common.exception.BusinessException;
import com.learnup.common.response.PageResponse;
import com.learnup.notification.config.MailProperties;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.entity.EmailLog;
import com.learnup.notification.repository.EmailLogRepository;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
        log.info("Processing email dispatch to recipient: [{}] with subject: [{}]",
                request.getRecipientEmail(), request.getSubject());

        String status = "SENT";
        String errorMessage = null;

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();

        if (mailProperties.isEnabled() && mailSender != null) {
            try {
                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());

                helper.setFrom(mailProperties.getFrom());
                helper.setTo(request.getRecipientEmail());
                helper.setSubject(request.getSubject());

                boolean isHtml = request.getBody() != null && request.getBody().contains("<") && request.getBody().contains(">");
                helper.setText(request.getBody(), isHtml);

                mailSender.send(message);
                log.info("Physical email successfully dispatched via SMTP to [{}]", request.getRecipientEmail());
            } catch (Exception e) {
                log.error("Failed to physically send email to [{}] via SMTP: {}", request.getRecipientEmail(), e.getMessage(), e);
                status = "FAILED";
                errorMessage = e.getMessage();
            }
        } else {
            log.info("Email dispatch simulated in mock/log mode (learnup.mail.enabled is false or JavaMailSender unavailable). Recipient: [{}]",
                    request.getRecipientEmail());
        }

        EmailLog emailLog = new EmailLog(
                UUID.randomUUID(),
                request.getRecipientEmail(),
                request.getSubject(),
                status,
                errorMessage,
                Instant.now()
        );

        EmailLog saved = emailLogRepository.save(emailLog);
        log.info("Email dispatch recorded in email_logs with ID: [{}] and status: [{}]", saved.getId(), saved.getStatus());

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
