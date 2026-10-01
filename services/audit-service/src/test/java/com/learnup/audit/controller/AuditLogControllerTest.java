package com.learnup.audit.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.audit.dto.CreateAuditLogRequest;
import com.learnup.audit.repository.AuditLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuditLogControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @BeforeEach
    void setUp() {
        auditLogRepository.deleteAll();
    }

    @Test
    @DisplayName("Should successfully record and retrieve audit log")
    void shouldRecordAndRetrieveAuditLog() throws Exception {
        UUID orgId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();

        CreateAuditLogRequest request = new CreateAuditLogRequest(
                orgId,
                actorId,
                "ORGANIZER",
                "COURSE_PUBLISHED",
                "COURSE",
                "course-123",
                "{\"title\":\"Java Microservices\"}",
                "127.0.0.1",
                "corr-abc-123"
        );

        String responseBody = mockMvc.perform(post("/api/audit/logs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").isNotEmpty())
                .andExpect(jsonPath("$.data.organizationId").value(orgId.toString()))
                .andExpect(jsonPath("$.data.actorUserId").value(actorId.toString()))
                .andExpect(jsonPath("$.data.actionType").value("COURSE_PUBLISHED"))
                .andExpect(jsonPath("$.data.targetResourceType").value("COURSE"))
                .andExpect(jsonPath("$.data.targetResourceId").value("course-123"))
                .andExpect(jsonPath("$.data.correlationId").value("corr-abc-123"))
                .andReturn().getResponse().getContentAsString();

        String logId = objectMapper.readTree(responseBody).path("data").path("id").asText();

        // Get by ID
        mockMvc.perform(get("/api/audit/logs/" + logId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(logId))
                .andExpect(jsonPath("$.data.actionType").value("COURSE_PUBLISHED"));

        // Query with filters
        mockMvc.perform(get("/api/audit/logs")
                        .param("organizationId", orgId.toString())
                        .param("actionType", "COURSE_PUBLISHED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items", hasSize(1)))
                .andExpect(jsonPath("$.data.totalElements").value(1));
    }

    @Test
    @DisplayName("Should return 404 when audit log ID is not found")
    void shouldReturn404WhenNotFound() throws Exception {
        UUID unknownId = UUID.randomUUID();

        mockMvc.perform(get("/api/audit/logs/" + unknownId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    @DisplayName("Should return 400 when required fields are missing in create request")
    void shouldReturn400OnInvalidRequest() throws Exception {
        CreateAuditLogRequest invalidRequest = new CreateAuditLogRequest();
        // actionType is null/blank

        mockMvc.perform(post("/api/audit/logs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("Should support /api/v1 route prefix for audit logs")
    void shouldSupportV1RoutePrefix() throws Exception {
        UUID orgId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();

        CreateAuditLogRequest request = new CreateAuditLogRequest(
                orgId,
                actorId,
                "ADMIN",
                "SETTING_CHANGED",
                "ORGANIZATION",
                orgId.toString(),
                "{}",
                "127.0.0.1",
                "corr-v1"
        );

        String res = mockMvc.perform(post("/api/v1/audit/logs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn().getResponse().getContentAsString();

        String id = objectMapper.readTree(res).path("data").path("id").asText();

        mockMvc.perform(get("/api/v1/audit/logs/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.actionType").value("SETTING_CHANGED"));

        mockMvc.perform(get("/api/v1/audit/logs")
                        .param("organizationId", orgId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items", hasSize(1)));
    }
}
