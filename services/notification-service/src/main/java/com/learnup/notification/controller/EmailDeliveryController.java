package com.learnup.notification.controller;

import com.learnup.common.response.ApiResponse;
import com.learnup.common.response.PageResponse;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.common.context.HeaderConstants;
import com.learnup.notification.security.ServiceCallOnly;
import com.learnup.notification.service.EmailDeliveryService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/v1/notifications/email", "/api/notifications/email"})
public class EmailDeliveryController {

    private final EmailDeliveryService emailDeliveryService;

    public EmailDeliveryController(EmailDeliveryService emailDeliveryService) {
        this.emailDeliveryService = emailDeliveryService;
    }

    @PostMapping("/send")
    public ResponseEntity<ApiResponse<EmailLogResponse>> sendEmail(
            @RequestHeader(value = HeaderConstants.X_USER_ID, required = false) String headerUserId,
            @Valid @RequestBody SendEmailRequest request) {
        ServiceCallOnly.require(headerUserId);
        EmailLogResponse response = emailDeliveryService.sendEmail(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @GetMapping("/logs")
    public ResponseEntity<ApiResponse<PageResponse<EmailLogResponse>>> getEmailLogs(
            @RequestHeader(value = HeaderConstants.X_USER_ID, required = false) String headerUserId,
            @RequestParam(required = false) String recipientEmail,
            @PageableDefault(size = 20, sort = "sentAt", direction = Sort.Direction.DESC) Pageable pageable) {
        ServiceCallOnly.require(headerUserId);
        PageResponse<EmailLogResponse> response = emailDeliveryService.getEmailLogs(recipientEmail, pageable);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
