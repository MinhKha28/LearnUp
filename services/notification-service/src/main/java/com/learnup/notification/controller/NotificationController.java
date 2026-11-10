package com.learnup.notification.controller;

import com.learnup.common.exception.BusinessException;
import com.learnup.common.response.ApiResponse;
import com.learnup.common.response.PageResponse;
import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.dto.NotificationResponse;
import com.learnup.notification.dto.UnreadCountResponse;
import com.learnup.notification.security.NotificationCaller;
import com.learnup.notification.service.NotificationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * UC49 in-app notifications. The caller is established by {@code InAppNotificationAuthenticationFilter}
 * (internal key + Gateway identity); the recipient of every user operation is always the caller.
 */
@RestController
@RequestMapping({"/api/v1/notifications", "/api/notifications"})
public class NotificationController {

    private static final String USER_ID_PARAMETER = "userId";

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @PostMapping("/send")
    public ResponseEntity<ApiResponse<NotificationResponse>> sendNotification(
            HttpServletRequest httpRequest,
            @Valid @RequestBody CreateNotificationRequest request) {
        NotificationCaller.requireService(httpRequest);
        NotificationResponse response = notificationService.sendNotification(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<NotificationResponse>>> getUserNotifications(
            HttpServletRequest httpRequest,
            @RequestParam(required = false, defaultValue = "false") boolean unreadOnly,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        NotificationCaller caller = currentUser(httpRequest);
        PageResponse<NotificationResponse> response = notificationService.getUserNotifications(
                caller.userId(), caller.organizationId(), unreadOnly, pageable);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<ApiResponse<NotificationResponse>> markAsRead(
            HttpServletRequest httpRequest,
            @PathVariable UUID id) {
        NotificationCaller caller = currentUser(httpRequest);
        NotificationResponse response = notificationService.markAsRead(id, caller.userId(), caller.organizationId());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<UnreadCountResponse>> getUnreadCount(HttpServletRequest httpRequest) {
        NotificationCaller caller = currentUser(httpRequest);
        long count = notificationService.getUnreadCount(caller.userId(), caller.organizationId());
        return ResponseEntity.ok(ApiResponse.success(new UnreadCountResponse(caller.userId(), count)));
    }

    /** The recipient is never chosen by the client: a caller-supplied userId is refused, not ignored. */
    private static NotificationCaller currentUser(HttpServletRequest httpRequest) {
        NotificationCaller caller = NotificationCaller.requireUser(httpRequest);
        if (httpRequest.getParameter(USER_ID_PARAMETER) != null) {
            throw BusinessException.badRequest("The recipient is the authenticated user; userId is not accepted");
        }
        return caller;
    }
}
