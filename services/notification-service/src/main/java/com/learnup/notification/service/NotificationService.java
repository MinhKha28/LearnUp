package com.learnup.notification.service;

import com.learnup.common.exception.BusinessException;
import com.learnup.common.response.PageResponse;
import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.dto.NotificationResponse;
import com.learnup.notification.entity.Notification;
import com.learnup.notification.repository.NotificationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public NotificationResponse sendNotification(CreateNotificationRequest request) {
        Notification notification = new Notification(
                UUID.randomUUID(),
                request.getOrganizationId(),
                request.getRecipientUserId(),
                request.getTitle(),
                request.getMessage(),
                request.getType(),
                request.getChannel(),
                false,
                null,
                request.getMetadata(),
                Instant.now()
        );

        Notification saved = notificationRepository.save(notification);
        return NotificationResponse.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> getUserNotifications(UUID recipientUserId, Boolean unreadOnly, Pageable pageable) {
        Page<Notification> pageResult;
        if (Boolean.TRUE.equals(unreadOnly)) {
            pageResult = notificationRepository.findByRecipientUserIdAndIsReadOrderByCreatedAtDesc(recipientUserId, false, pageable);
        } else {
            pageResult = notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(recipientUserId, pageable);
        }

        List<NotificationResponse> items = pageResult.getContent().stream()
                .map(NotificationResponse::fromEntity)
                .toList();

        return PageResponse.of(items, pageResult.getNumber(), pageResult.getSize(), pageResult.getTotalElements());
    }

    @Transactional
    public NotificationResponse markAsRead(UUID notificationId, UUID recipientUserId) {
        Notification notification = notificationRepository.findByIdAndRecipientUserId(notificationId, recipientUserId)
                .orElseThrow(() -> BusinessException.notFound("Notification not found for ID: " + notificationId));

        notification.markAsRead();
        Notification updated = notificationRepository.save(notification);
        return NotificationResponse.fromEntity(updated);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(UUID recipientUserId) {
        return notificationRepository.countByRecipientUserIdAndIsReadFalse(recipientUserId);
    }
}
