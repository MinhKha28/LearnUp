package com.learnup.notification.controller;

import com.learnup.common.response.ApiResponse;
import com.learnup.common.response.PageResponse;
import com.learnup.notification.dto.EmailLogResponse;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.service.EmailDeliveryService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications/email")
public class EmailDeliveryController {

    private final EmailDeliveryService emailDeliveryService;

    public EmailDeliveryController(EmailDeliveryService emailDeliveryService) {
        this.emailDeliveryService = emailDeliveryService;
    }

    @PostMapping("/send")
    public ResponseEntity<ApiResponse<EmailLogResponse>> sendEmail(
            @Valid @RequestBody SendEmailRequest request) {
        EmailLogResponse response = emailDeliveryService.sendEmail(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @GetMapping("/logs")
    public ResponseEntity<ApiResponse<PageResponse<EmailLogResponse>>> getEmailLogs(
            @RequestParam(required = false) String recipientEmail,
            @PageableDefault(size = 20, sort = "sentAt", direction = Sort.Direction.DESC) Pageable pageable) {
        PageResponse<EmailLogResponse> response = emailDeliveryService.getEmailLogs(recipientEmail, pageable);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
