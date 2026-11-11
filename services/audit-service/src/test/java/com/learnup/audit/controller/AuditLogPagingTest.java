package com.learnup.audit.controller;

import com.learnup.audit.entity.AuditLog;
import com.learnup.audit.repository.AuditLogRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** UC50, UC51: the order and the size of a page are the service's decision, not the caller's. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuditLogPagingTest {

    private static final String KEY = "audit-test-only-key-0123456789abcdef0123";
    private static final UUID ORG = UUID.fromString("00000000-0000-4000-8000-0000000000a1");
    private static final UUID USER = UUID.fromString("00000000-0000-4000-8000-0000000000c3");
    private static final Instant T = Instant.parse("2026-11-02T00:00:00Z");

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private AuditLogRepository repository;
    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void clean() {
        repository.deleteAll();
    }

    private void save(String action, Instant at) {
        UUID id = UUID.randomUUID();
        repository.save(new AuditLog(id, ORG, USER, "ADMIN", action, "User", "t-" + id, "{}", null, "c-" + id, at));
    }

    private JsonNode list(String... params) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/v1/audit/logs")
                .header("x-internal-key", KEY).header("X-User-ID", USER.toString()).header("X-User-Role", "ADMIN");
        for (int i = 0; i < params.length; i += 2) {
            request.param(params[i], params[i + 1]);
        }
        String body = mockMvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("data");
    }

    @Test
    @DisplayName("a sort the caller sends is ignored: an unknown property is no longer a 500, a known one does not change the order")
    void callerSortIsIgnored() throws Exception {
        save("A_OLD", T);
        save("B_MID", T.plusSeconds(10));
        save("C_NEW", T.plusSeconds(20));
        for (String sort : new String[]{"nope,asc", "actionType,asc", "createdAt,asc", "id", ",", "organizationId,desc"}) {
            JsonNode data = list("sort", sort);
            assertEquals("C_NEW", data.path("items").get(0).path("actionType").asText(), "sort=" + sort);
            assertEquals("A_OLD", data.path("items").get(2).path("actionType").asText(), "sort=" + sort);
        }
    }

    @Test
    @DisplayName("a page is at most 100 entries, however large the caller asks")
    void pageSizeHasACeiling() throws Exception {
        for (int i = 0; i < 130; i++) {
            save("E" + i, T.plusSeconds(i));
        }
        JsonNode data = list("size", "100000");
        assertEquals(100, data.path("items").size());
        assertEquals(100, data.path("size").asInt());
        assertEquals(130, data.path("totalElements").asInt());
        assertEquals(2, data.path("totalPages").asInt());
        assertEquals(20, list().path("items").size(), "the default stays 20");
    }

    @Test
    @DisplayName("entries with the same time are neither repeated nor skipped from one page to the next")
    void tiesDoNotBreakPaging() throws Exception {
        for (int i = 0; i < 25; i++) {
            save("SAME_" + i, T); // the same createdAt for all
        }
        Set<String> seen = new HashSet<>();
        List<String> order = new ArrayList<>();
        for (int page = 0; page < 3; page++) {
            for (JsonNode item : list("size", "10", "page", String.valueOf(page)).path("items")) {
                order.add(item.path("id").asText());
                seen.add(item.path("id").asText());
            }
        }
        assertEquals(25, order.size());
        assertEquals(25, seen.size(), "no entry appears twice");
        // the same query twice gives the same order
        List<String> again = new ArrayList<>();
        for (int page = 0; page < 3; page++) {
            for (JsonNode item : list("size", "10", "page", String.valueOf(page)).path("items")) {
                again.add(item.path("id").asText());
            }
        }
        assertEquals(order, again);
    }

    @Test
    @DisplayName("a page past the end is an empty page with the right total, not an error")
    void pagePastTheEnd() throws Exception {
        save("ONLY", T);
        JsonNode data = list("page", "9");
        assertEquals(0, data.path("items").size());
        assertEquals(1, data.path("totalElements").asInt());
        assertTrue(data.path("last").asBoolean());
    }
}
