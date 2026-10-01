package com.learnup.notification.controller;

import com.learnup.common.context.HeaderConstants;
import com.learnup.common.exception.BusinessException;
import com.learnup.common.response.ApiResponse;
import com.learnup.common.response.PageResponse;
import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.dto.NotificationResponse;
import com.learnup.notification.dto.UnreadCountResponse;
import com.learnup.notification.service.NotificationService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping({"/api/v1/notifications", "/api/notifications"})
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @PostMapping("/send")
    public ResponseEntity<ApiResponse<NotificationResponse>> sendNotification(
            @Valid @RequestBody CreateNotificationRequest request) {
        NotificationResponse response = notificationService.sendNotification(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<NotificationResponse>>> getUserNotifications(
            @RequestHeader(value = HeaderConstants.X_USER_ID, required = false) String headerUserId,
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false, defaultValue = "false") boolean unreadOnly,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {

        UUID targetUserId = resolveUserId(headerUserId, userId);
        PageResponse<NotificationResponse> response = notificationService.getUserNotifications(targetUserId, unreadOnly, pageable);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<ApiResponse<NotificationResponse>> markAsRead(
            @PathVariable UUID id,
            @RequestHeader(value = HeaderConstants.X_USER_ID, required = false) String headerUserId,
            @RequestParam(required = false) UUID userId) {

        UUID targetUserId = resolveUserId(headerUserId, userId);
        NotificationResponse response = notificationService.markAsRead(id, targetUserId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<UnreadCountResponse>> getUnreadCount(
            @RequestHeader(value = HeaderConstants.X_USER_ID, required = false) String headerUserId,
            @RequestParam(required = false) UUID userId) {

        UUID targetUserId = resolveUserId(headerUserId, userId);
        long count = notificationService.getUnreadCount(targetUserId);
        return ResponseEntity.ok(ApiResponse.success(new UnreadCountResponse(targetUserId, count)));
    }

    private UUID resolveUserId(String headerUserId, UUID queryUserId) {
        if (headerUserId != null && !headerUserId.isBlank()) {
            try {
                return UUID.fromString(headerUserId);
            } catch (IllegalArgumentException e) {
                // Fallback to query param
            }
        }
        if (queryUserId != null) {
            return queryUserId;
        }
        throw BusinessException.badRequest("Target user ID is required via header or query parameter");
    }
}
