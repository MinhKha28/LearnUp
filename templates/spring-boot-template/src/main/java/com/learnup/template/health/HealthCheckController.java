package com.learnup.template.health;

import com.learnup.common.api.ApiResponse;
import com.learnup.common.context.SecurityContextHolder;
import com.learnup.common.context.UserContext;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Baseline health and execution context verification controller (Zero domain logic).
 */
@RestController
@RequestMapping("/api/v1/ping")
public class HealthCheckController {

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> ping() {
        UserContext ctx = SecurityContextHolder.getContext();
        Map<String, Object> payload = Map.of(
                "status", "UP",
                "organizationId", ctx != null && ctx.getOrganizationId() != null ? ctx.getOrganizationId() : "NONE",
                "userId", ctx != null && ctx.getUserId() != null ? ctx.getUserId() : "ANONYMOUS"
        );
        return ResponseEntity.ok(ApiResponse.ok(payload));
    }
}
