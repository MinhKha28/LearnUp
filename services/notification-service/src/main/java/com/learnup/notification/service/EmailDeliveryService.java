package com.learnup.notification.service;

import com.learnup.common.response.PageResponse;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.entity.EmailLog;
import com.learnup.notification.repository.EmailLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class EmailDeliveryService {

    private static final Logger log = LoggerFactory.getLogger(EmailDeliveryService.class);

    private final EmailLogRepository emailLogRepository;

    public EmailDeliveryService(EmailLogRepository emailLogRepository) {
        this.emailLogRepository = emailLogRepository;
    }

    @Transactional
    public EmailLogResponse sendEmail(SendEmailRequest request) {
        log.info("Dispatching email to recipient: [{}] with subject: [{}]",
                request.getRecipientEmail(), request.getSubject());

        // Pluggable dispatch abstraction - logs and records dispatched status
        EmailLog emailLog = new EmailLog(
                UUID.randomUUID(),
                request.getRecipientEmail(),
                request.getSubject(),
                "SENT",
                null,
                Instant.now()
        );

        EmailLog saved = emailLogRepository.save(emailLog);
        log.info("Email recorded in email_logs with ID: [{}]", saved.getId());
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
