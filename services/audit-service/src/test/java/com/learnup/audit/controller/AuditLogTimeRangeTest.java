package com.learnup.audit.controller;

import com.learnup.audit.entity.AuditLog;
import com.learnup.audit.repository.AuditLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;
import java.util.UUID;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** UC50, UC51: the time range of the list (from included, to excluded), together with the scope of the caller and the other filters. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuditLogTimeRangeTest {

    private static final String KEY = "audit-test-only-key-0123456789abcdef0123";
    private static final UUID ORG_A = UUID.fromString("00000000-0000-4000-8000-0000000000a1");
    private static final UUID ORG_B = UUID.fromString("00000000-0000-4000-8000-0000000000b2");
    private static final UUID USER = UUID.fromString("00000000-0000-4000-8000-0000000000c3");

    private static final Instant DAY_1 = Instant.parse("2026-11-01T00:00:00Z");
    private static final Instant DAY_2 = Instant.parse("2026-11-02T00:00:00Z");
    private static final Instant DAY_3 = Instant.parse("2026-11-03T00:00:00Z");

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private AuditLogRepository repository;

    @BeforeEach
    void seed() {
        repository.deleteAll();
        // org A: one entry at the start of each day, plus one a second before the end of day 1
        save(ORG_A, "D1_START", DAY_1);
        save(ORG_A, "D1_END", DAY_2.minusSeconds(1));
        save(ORG_A, "D2_START", DAY_2);
        save(ORG_A, "D3_START", DAY_3);
        save(ORG_B, "OTHER_ORG_D1", DAY_1.plusSeconds(60));
        save(null, "PLATFORM_D1", DAY_1.plusSeconds(120));
    }

    private void save(UUID organization, String action, Instant at) {
        UUID id = UUID.randomUUID();
        repository.save(new AuditLog(id, organization, USER, "ADMIN", action, "User", "t-" + id, "{}", null, "c-" + id, at));
    }

    private ResultActions list(String role, UUID organization, String... params) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/v1/audit/logs")
                .header("x-internal-key", KEY).header("X-User-ID", USER.toString()).header("X-User-Role", role);
        if (organization != null) {
            request.header("X-Organization-ID", organization.toString());
        }
        for (int i = 0; i < params.length; i += 2) {
            request.param(params[i], params[i + 1]);
        }
        return mockMvc.perform(request);
    }

    @Test
    @DisplayName("from is included and to is excluded: a whole day is [00:00, 00:00 of the next day)")
    void rangeIncludesFromAndExcludesTo() throws Exception {
        list("ORGANIZER", ORG_A, "from", DAY_1.toString(), "to", DAY_2.toString())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(2))
                .andExpect(jsonPath("$.data.items[*].actionType", containsInAnyOrder("D1_START", "D1_END")));
        list("ORGANIZER", ORG_A, "from", DAY_2.toString(), "to", DAY_3.toString())
                .andExpect(jsonPath("$.data.items[*].actionType", containsInAnyOrder("D2_START")));
    }

    @Test
    @DisplayName("from alone and to alone are open ranges")
    void openRanges() throws Exception {
        list("ORGANIZER", ORG_A, "from", DAY_2.toString())
                .andExpect(jsonPath("$.data.items[*].actionType", containsInAnyOrder("D2_START", "D3_START")));
        list("ORGANIZER", ORG_A, "to", DAY_2.toString())
                .andExpect(jsonPath("$.data.items[*].actionType", containsInAnyOrder("D1_START", "D1_END")));
    }

    @Test
    @DisplayName("no range at all keeps the old behavior: everything of the scope, newest first")
    void noRange() throws Exception {
        list("ORGANIZER", ORG_A)
                .andExpect(jsonPath("$.data.totalElements").value(4))
                .andExpect(jsonPath("$.data.items[0].actionType").value("D3_START"));
    }

    @Test
    @DisplayName("the range never widens the scope: an Organizer still sees only the own Organization")
    void rangeKeepsTheScope() throws Exception {
        list("ORGANIZER", ORG_A, "from", DAY_1.toString(), "to", DAY_3.toString())
                .andExpect(jsonPath("$.data.items[*].actionType", hasSize(3)))
                .andExpect(jsonPath("$.data.items[*].actionType", containsInAnyOrder("D1_START", "D1_END", "D2_START")));
        // an Admin sees every Organization and the platform entries in the same range
        list("ADMIN", null, "from", DAY_1.toString(), "to", DAY_2.toString())
                .andExpect(jsonPath("$.data.totalElements").value(4))
                .andExpect(jsonPath("$.data.items[*].actionType",
                        containsInAnyOrder("D1_START", "D1_END", "OTHER_ORG_D1", "PLATFORM_D1")));
    }

    @Test
    @DisplayName("the range works together with the target filters")
    void rangeWithTargetFilters() throws Exception {
        list("ADMIN", null, "from", DAY_1.toString(), "to", DAY_2.toString(), "targetResourceType", "User", "actionType", "PLATFORM_D1")
                .andExpect(jsonPath("$.data.totalElements").value(1));
        list("ADMIN", null, "from", DAY_1.toString(), "to", DAY_2.toString(), "targetResourceType", "Course")
                .andExpect(jsonPath("$.data.totalElements").value(0));
    }

    @Test
    @DisplayName("paging inside a range: totals stay right and pages do not repeat rows")
    void paging() throws Exception {
        list("ORGANIZER", ORG_A, "from", DAY_1.toString(), "to", DAY_3.plusSeconds(1).toString(), "size", "2", "page", "0")
                .andExpect(jsonPath("$.data.totalElements").value(4))
                .andExpect(jsonPath("$.data.totalPages").value(2))
                .andExpect(jsonPath("$.data.items", hasSize(2)));
        list("ORGANIZER", ORG_A, "from", DAY_1.toString(), "to", DAY_3.plusSeconds(1).toString(), "size", "2", "page", "1")
                .andExpect(jsonPath("$.data.items", hasSize(2)))
                .andExpect(jsonPath("$.data.items[*].actionType", containsInAnyOrder("D1_END", "D1_START")));
    }

    @Test
    @DisplayName("from not before to is 400 (equal, reversed), and so is a value that is not a time")
    void badRanges() throws Exception {
        list("ADMIN", null, "from", DAY_2.toString(), "to", DAY_2.toString()).andExpect(status().isBadRequest());
        list("ADMIN", null, "from", DAY_3.toString(), "to", DAY_1.toString()).andExpect(status().isBadRequest());
        list("ADMIN", null, "from", "yesterday").andExpect(status().isBadRequest());
        list("ADMIN", null, "to", "2026-13-45T99:00:00Z").andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("who may not read still may not read with a range (Instructor, Learner)")
    void rangeDoesNotOpenTheDoor() throws Exception {
        list("INSTRUCTOR", ORG_A, "from", DAY_1.toString()).andExpect(status().isForbidden());
        list("LEARNER", ORG_A, "from", DAY_1.toString()).andExpect(status().isForbidden());
    }
}
