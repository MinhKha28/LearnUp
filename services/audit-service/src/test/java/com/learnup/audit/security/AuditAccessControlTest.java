package com.learnup.audit.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.audit.dto.CreateAuditLogRequest;
import com.learnup.audit.entity.AuditLog;
import com.learnup.audit.repository.AuditLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Who may read and write the audit trail (UC50, UC51): the internal key on every request, an Admin reads all, an Organizer reads the
 * own Organization only, Instructors and Learners read nothing, and only the services write.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuditAccessControlTest {

    private static final String KEY = "audit-test-only-key-0123456789abcdef0123";
    private static final String[] PREFIXES = {"/api/audit/logs", "/api/v1/audit/logs"};

    private static final UUID ORG_A = UUID.fromString("00000000-0000-4000-8000-0000000000a1");
    private static final UUID ORG_B = UUID.fromString("00000000-0000-4000-8000-0000000000b2");
    private static final UUID USER = UUID.fromString("00000000-0000-4000-8000-0000000000c3");

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private AuditLogRepository repository;

    private UUID entryA1;
    private UUID entryA2;
    private UUID entryB;
    private UUID entryPlatform;

    @BeforeEach
    void seed() {
        repository.deleteAll();
        entryA1 = save(ORG_A, "COURSE_DISABLED");
        entryA2 = save(ORG_A, "MEMBER_INVITED");
        entryB = save(ORG_B, "COURSE_DISABLED");
        entryPlatform = save(null, "ORGANIZATION_SUSPENDED");
    }

    private UUID save(UUID organization, String action) {
        UUID id = UUID.randomUUID();
        repository.save(new AuditLog(id, organization, USER, "ADMIN", action, "COURSE", "target-" + id, "{}", "127.0.0.1",
                "corr-" + id, Instant.now()));
        return id;
    }

    /** The headers the gateway sends for an authenticated user. */
    private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder request, String role, UUID organization) {
        request.header("x-internal-key", KEY).header("X-User-ID", USER.toString()).header("X-User-Role", role);
        if (organization != null) {
            request.header("X-Organization-ID", organization.toString());
        }
        return request;
    }

    private MockHttpServletRequestBuilder asService(MockHttpServletRequestBuilder request) {
        return request.header("x-internal-key", KEY);
    }

    private String body() throws Exception {
        return objectMapper.writeValueAsString(new CreateAuditLogRequest(ORG_A, USER, "ORGANIZER", "COURSE_PUBLISHED", "COURSE",
                "course-1", "{}", "127.0.0.1", "corr-new"));
    }

    // ------------------------------------------------------------------ the internal key

    @Test
    @DisplayName("without the internal key every request is 401, read or write, on both prefixes")
    void withoutKeyEverythingIs401() throws Exception {
        for (String prefix : PREFIXES) {
            mockMvc.perform(get(prefix)).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false))
                    .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
            mockMvc.perform(get(prefix + "/" + entryA1)).andExpect(status().isUnauthorized());
            mockMvc.perform(post(prefix).contentType(MediaType.APPLICATION_JSON).content(body())).andExpect(status().isUnauthorized());
            // a user header alone proves nothing: the gateway is the only one that adds them together with the key
            mockMvc.perform(get(prefix).header("X-User-Role", "ADMIN").header("X-User-ID", USER.toString()))
                    .andExpect(status().isUnauthorized());
        }
        assertEquals(4, repository.count());
    }

    @Test
    @DisplayName("a wrong key is 401: the old default, an empty one, a prefix of the key, extra spaces, other letter case")
    void wrongKeysAre401() throws Exception {
        String[] wrong = {"learnup-internal-secret", "", KEY.substring(0, KEY.length() - 1), KEY + " ", " " + KEY, KEY.toUpperCase(),
                KEY + KEY};
        for (String key : wrong) {
            mockMvc.perform(get("/api/audit/logs").header("x-internal-key", key).header("X-User-Role", "ADMIN"))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Test
    @DisplayName("everything but the health endpoint needs the key, whatever the path is")
    void onlyHealthIsOpen() throws Exception {
        mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
        mockMvc.perform(get("/actuator/info")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/actuator")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/audit/logs;x=1")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/API/AUDIT/LOGS")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/anything/else")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/audit/logs/").header("X-User-Role", "ADMIN")).andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------------------ reading

    @Test
    @DisplayName("an Admin reads every entry, the platform ones too, and can filter by Organization")
    void adminReadsEverything() throws Exception {
        for (String prefix : PREFIXES) {
            mockMvc.perform(asUser(get(prefix), "ADMIN", null)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items", hasSize(4))).andExpect(jsonPath("$.data.totalElements").value(4));
            mockMvc.perform(asUser(get(prefix).param("organizationId", ORG_B.toString()), "ADMIN", null)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items", hasSize(1))).andExpect(jsonPath("$.data.items[0].id").value(entryB.toString()));
            mockMvc.perform(asUser(get(prefix + "/" + entryPlatform), "ADMIN", null)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.actionType").value("ORGANIZATION_SUSPENDED"));
            mockMvc.perform(asUser(get(prefix + "/" + entryB), "ADMIN", null)).andExpect(status().isOk());
        }
    }

    @Test
    @DisplayName("an Organizer reads only the own Organization: never another one, never a platform entry")
    void organizerReadsOnlyOwnOrganization() throws Exception {
        for (String prefix : PREFIXES) {
            mockMvc.perform(asUser(get(prefix), "ORGANIZER", ORG_A)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items", hasSize(2)))
                    .andExpect(jsonPath("$.data.items[*].organizationId", everyItem(is(ORG_A.toString()))));
            mockMvc.perform(asUser(get(prefix).param("organizationId", ORG_A.toString()), "ORGANIZER", ORG_A))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.items", hasSize(2)));
            // the other filters stay inside the own Organization
            mockMvc.perform(asUser(get(prefix).param("actionType", "COURSE_DISABLED"), "ORGANIZER", ORG_A)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items", hasSize(1))).andExpect(jsonPath("$.data.items[0].id").value(entryA1.toString()));
            mockMvc.perform(asUser(get(prefix).param("actorUserId", USER.toString()).param("targetResourceType", "COURSE"), "ORGANIZER", ORG_B))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.items", hasSize(1)))
                    .andExpect(jsonPath("$.data.items[0].id").value(entryB.toString()));
            mockMvc.perform(asUser(get(prefix + "/" + entryA2), "ORGANIZER", ORG_A)).andExpect(status().isOk());
        }
    }

    @Test
    @DisplayName("an Organizer asking for another Organization is 403, and a list of ids cannot widen the scope")
    void organizerCannotAskForAnotherOrganization() throws Exception {
        mockMvc.perform(asUser(get("/api/audit/logs").param("organizationId", ORG_B.toString()), "ORGANIZER", ORG_A))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
        // two values or a comma list are not a UUID: refused (the exact status depends on the shared exception handler), never answered with data
        mockMvc.perform(asUser(get("/api/audit/logs").param("organizationId", ORG_A + "," + ORG_B), "ORGANIZER", ORG_A))
                .andExpect(status().is(greaterThanOrEqualTo(400))).andExpect(jsonPath("$.data").doesNotExist());
        // the same parameter twice: either refused, or bound to the first value; in no case the data of the other Organization
        var twice = mockMvc.perform(asUser(get("/api/audit/logs").param("organizationId", ORG_A.toString()).param("organizationId", ORG_B.toString()),
                "ORGANIZER", ORG_A)).andReturn().getResponse();
        org.junit.jupiter.api.Assertions.assertFalse(twice.getContentAsString().contains(ORG_B.toString()));
        org.junit.jupiter.api.Assertions.assertFalse(twice.getContentAsString().contains(entryB.toString()));
        org.junit.jupiter.api.Assertions.assertFalse(twice.getContentAsString().contains(entryPlatform.toString()));
        mockMvc.perform(asUser(get("/api/audit/logs").param("organizationId", "not-a-uuid"), "ORGANIZER", ORG_A))
                .andExpect(status().is(greaterThanOrEqualTo(400)));
    }

    @Test
    @DisplayName("an entry of another Organization or of the platform looks to an Organizer like an id that does not exist")
    void foreignEntryLooksMissingToAnOrganizer() throws Exception {
        String missing = mockMvc.perform(asUser(get("/api/audit/logs/" + UUID.randomUUID()), "ORGANIZER", ORG_A))
                .andExpect(status().isNotFound()).andReturn().getResponse().getContentAsString();
        for (UUID foreign : new UUID[]{entryB, entryPlatform}) {
            String body = mockMvc.perform(asUser(get("/api/audit/logs/" + foreign), "ORGANIZER", ORG_A))
                    .andExpect(status().isNotFound()).andExpect(jsonPath("$.error.code").value("RESOURCE_NOT_FOUND"))
                    .andReturn().getResponse().getContentAsString();
            // same shape as a missing id, and nothing of the entry in it
            assertEquals(objectMapper.readTree(missing).path("error").path("code"), objectMapper.readTree(body).path("error").path("code"));
            org.junit.jupiter.api.Assertions.assertFalse(body.contains("ORGANIZATION_SUSPENDED"));
            org.junit.jupiter.api.Assertions.assertFalse(body.contains(ORG_B.toString()));
        }
    }

    @Test
    @DisplayName("an Organizer without a valid Organization is 403")
    void organizerNeedsAnOrganization() throws Exception {
        mockMvc.perform(asUser(get("/api/audit/logs"), "ORGANIZER", null)).andExpect(status().isForbidden());
        mockMvc.perform(asUser(get("/api/audit/logs"), "ORGANIZER", null).header("X-Organization-ID", "not-a-uuid"))
                .andExpect(status().isForbidden());
        mockMvc.perform(asUser(get("/api/audit/logs"), "ORGANIZER", null).header("X-Organization-ID", " "))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Instructors, Learners, unknown roles and a missing role read nothing: 403 on the list and on one entry")
    void everyoneElseIs403() throws Exception {
        for (String role : new String[]{"INSTRUCTOR", "LEARNER", "SUPERUSER", "SYSTEM", "ROOT", "", " ", "admin;LEARNER", "ADMIN,LEARNER"}) {
            for (String prefix : PREFIXES) {
                mockMvc.perform(asUser(get(prefix), role, ORG_A)).andExpect(status().isForbidden())
                        .andExpect(jsonPath("$.error.code").value("FORBIDDEN")).andExpect(jsonPath("$.data").doesNotExist());
                mockMvc.perform(asUser(get(prefix + "/" + entryA1), role, ORG_A)).andExpect(status().isForbidden());
            }
        }
        // a service without a user context does not read the trail either
        mockMvc.perform(asService(get("/api/audit/logs"))).andExpect(status().isForbidden());
        mockMvc.perform(asService(get("/api/audit/logs/" + entryA1))).andExpect(status().isForbidden());
        mockMvc.perform(asService(options("/api/audit/logs"))).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("a refusal says nothing about the entries")
    void refusalIsQuiet() throws Exception {
        String body = mockMvc.perform(asUser(get("/api/audit/logs"), "LEARNER", ORG_A)).andExpect(status().isForbidden())
                .andReturn().getResponse().getContentAsString();
        for (String text : new String[]{"COURSE_DISABLED", "MEMBER_INVITED", ORG_A.toString(), ORG_B.toString(), KEY}) {
            org.junit.jupiter.api.Assertions.assertFalse(body.contains(text), "the refusal must not contain " + text);
        }
    }

    // ------------------------------------------------------------------ writing

    @Test
    @DisplayName("a service writes an entry with the key and no user context")
    void serviceWrites() throws Exception {
        for (String prefix : PREFIXES) {
            mockMvc.perform(asService(post(prefix)).contentType(MediaType.APPLICATION_JSON).content(body()))
                    .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").isNotEmpty());
        }
        assertEquals(6, repository.count());
    }

    @Test
    @DisplayName("a user cannot write an entry, whatever the role: 403 and nothing is stored")
    void userCannotWrite() throws Exception {
        for (String role : new String[]{"ADMIN", "ORGANIZER", "INSTRUCTOR", "LEARNER", "SUPERUSER"}) {
            mockMvc.perform(asUser(post("/api/v1/audit/logs"), role, ORG_A).contentType(MediaType.APPLICATION_JSON).content(body()))
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
        }
        // any single part of a user context is enough to be refused
        mockMvc.perform(asService(post("/api/audit/logs")).header("X-Organization-ID", ORG_A.toString())
                .contentType(MediaType.APPLICATION_JSON).content(body())).andExpect(status().isForbidden());
        mockMvc.perform(asService(post("/api/audit/logs")).header("X-User-ID", USER.toString())
                .contentType(MediaType.APPLICATION_JSON).content(body())).andExpect(status().isForbidden());
        mockMvc.perform(asService(post("/api/audit/logs")).header("Authorization", "Bearer abc")
                .contentType(MediaType.APPLICATION_JSON).content(body())).andExpect(status().isForbidden());
        assertEquals(4, repository.count());
    }

    @Test
    @DisplayName("an entry cannot be changed or deleted: no route, and a user is refused before that")
    void trailIsAppendOnly() throws Exception {
        for (HttpMethod method : new HttpMethod[]{HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE}) {
            mockMvc.perform(asService(request(method, "/api/audit/logs/" + entryA1)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().is(greaterThanOrEqualTo(400)));
            mockMvc.perform(asUser(request(method, "/api/audit/logs/" + entryA1), "ADMIN", null).contentType(MediaType.APPLICATION_JSON)
                    .content("{}")).andExpect(status().isForbidden());
        }
        assertEquals(4, repository.count());
    }

    @Test
    @DisplayName("an invalid body is still 400 for a service, and the filter runs before the validation")
    void validationStillWorksForTheService() throws Exception {
        mockMvc.perform(asService(post("/api/audit/logs")).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
        mockMvc.perform(asUser(post("/api/audit/logs"), "LEARNER", ORG_A).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }
}
