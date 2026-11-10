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
    public PageResponse<NotificationResponse> getUserNotifications(UUID recipientUserId, UUID organizationId, Boolean unreadOnly, Pageable pageable) {
        // UC49 scope: own notifications in the caller's Organization plus platform notices. A caller with
        // no Organization (platform Admin) sees platform notices only; "= null" never matches in SQL.
        boolean unread = Boolean.TRUE.equals(unreadOnly);
        Page<Notification> pageResult = unread
                ? notificationRepository.findVisibleUnread(recipientUserId, organizationId, pageable)
                : notificationRepository.findVisible(recipientUserId, organizationId, pageable);

        List<NotificationResponse> items = pageResult.getContent().stream()
                .map(NotificationResponse::fromEntity)
                .toList();

        return PageResponse.of(items, pageResult.getNumber(), pageResult.getSize(), pageResult.getTotalElements());
    }

    @Transactional
    public NotificationResponse markAsRead(UUID notificationId, UUID recipientUserId, UUID organizationId) {
        // Someone else's notification, or one outside the caller's scope, is indistinguishable from a missing one.
        Notification notification = notificationRepository.findVisibleById(notificationId, recipientUserId, organizationId)
                .orElseThrow(() -> BusinessException.notFound("Notification not found"));

        // Opening it again must not move the time it was first read.
        if (notification.isRead()) {
            return NotificationResponse.fromEntity(notification);
        }
        notification.markAsRead();
        Notification updated = notificationRepository.save(notification);
        return NotificationResponse.fromEntity(updated);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(UUID recipientUserId, UUID organizationId) {
        return notificationRepository.countVisibleUnread(recipientUserId, organizationId);
    }
}
