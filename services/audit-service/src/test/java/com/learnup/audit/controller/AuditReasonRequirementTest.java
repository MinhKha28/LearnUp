package com.learnup.audit.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.audit.repository.AuditLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** BR-337: the actions whose affected party is notified are recorded only with a reason, and the reason reaches the reader. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuditReasonRequirementTest {

    private static final String KEY = "audit-test-only-key-0123456789abcdef0123";
    private static final UUID ORG = UUID.fromString("00000000-0000-4000-8000-0000000000a1");
    private static final UUID ADMIN = UUID.fromString("00000000-0000-4000-8000-0000000000d4");

    @Autowired private MockMvc mockMvc;
    @Autowired private AuditLogRepository repository;
    @Autowired private ObjectMapper objectMapper;

    @BeforeEach
    void clean() {
        repository.deleteAll();
    }

    private int write(String actionType, String details) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("organizationId", ORG.toString());
        body.put("actorUserId", ADMIN.toString());
        body.put("actorRole", "ADMIN");
        body.put("actionType", actionType);
        body.put("targetResourceType", "Organization");
        body.put("targetResourceId", ORG.toString());
        if (details != null) {
            body.put("details", details);
        }
        return mockMvc.perform(post("/api/v1/audit/logs").header("x-internal-key", KEY)
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body)))
                .andReturn().getResponse().getStatus();
    }

    @ParameterizedTest(name = "{0} without a reason is refused")
    @ValueSource(strings = {"ORGANIZATION_SUSPENDED", "ORGANIZER_REPLACED", "COURSE_REJECTED", "CONTENT_DISABLED"})
    void reasonIsRequired(String actionType) throws Exception {
        assertThat(write(actionType, null)).isEqualTo(400);
        assertThat(write(actionType, "{}")).isEqualTo(400);
        assertThat(write(actionType, "{\"reason\":\"   \"}")).isEqualTo(400);
        assertThat(write(actionType, "{\"reason\":42}")).isEqualTo(400);
        assertThat(write(actionType, "not json")).isEqualTo(400);
        assertThat(repository.count()).isZero();

        assertThat(write(actionType, "{\"reason\":\"Unpaid invoice\"}")).isEqualTo(201);
        assertThat(repository.count()).isEqualTo(1);
    }

    @ParameterizedTest(name = "{0} keeps an optional reason")
    @ValueSource(strings = {"INSTRUCTOR_DEACTIVATED", "ORGANIZATION_SUSPENSION_LIFTED", "COURSE_APPROVED", "MEMBER_IMPORTED"})
    void reasonIsOptionalElsewhere(String actionType) throws Exception {
        assertThat(write(actionType, null)).isEqualTo(201);
        assertThat(write(actionType, "{}")).isEqualTo(201);
    }

    @Test
    @DisplayName("the recorded reason is returned to the Admin reading the trail")
    void reasonReachesTheReader() throws Exception {
        assertThat(write("ORGANIZATION_SUSPENDED", "{\"reason\":\"Unpaid invoice\"}")).isEqualTo(201);

        mockMvc.perform(get("/api/v1/audit/logs").header("x-internal-key", KEY)
                        .header("X-User-ID", ADMIN.toString()).header("X-User-Role", "ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].actionType").value("ORGANIZATION_SUSPENDED"))
                .andExpect(jsonPath("$.data.items[0].details").value("{\"reason\":\"Unpaid invoice\"}"));
    }
}
