package com.learnup.audit.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** UC50, UC51: the trail is dated by the time of the action when the writer says it, so the list and its time filter agree with the action. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuditLogOccurredAtTest {

    private static final String KEY = "audit-test-only-key-0123456789abcdef0123";
    private static final UUID ORG = UUID.fromString("00000000-0000-4000-8000-0000000000a1");
    private static final UUID USER = UUID.fromString("00000000-0000-4000-8000-0000000000c3");

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

    private int write(String occurredAtJson) throws Exception {
        String body = "{\"organizationId\":\"" + ORG + "\",\"actorUserId\":\"" + USER + "\",\"actorRole\":\"ORGANIZER\","
                + "\"actionType\":\"INSTRUCTOR_DEACTIVATED\",\"targetResourceType\":\"User\",\"targetResourceId\":\"t-1\","
                + "\"details\":\"{}\"" + (occurredAtJson == null ? "" : ",\"occurredAt\":" + occurredAtJson) + "}";
        return mockMvc.perform(post("/api/v1/audit/logs").header("x-internal-key", KEY)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse().getStatus();
    }

    private JsonNode list(String... params) throws Exception {
        var request = get("/api/v1/audit/logs").header("x-internal-key", KEY).header("X-User-ID", USER.toString())
                .header("X-User-Role", "ORGANIZER").header("X-Organization-ID", ORG.toString());
        for (int i = 0; i < params.length; i += 2) {
            request.param(params[i], params[i + 1]);
        }
        String text = mockMvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(text).path("data");
    }

    @Test
    @DisplayName("an entry with occurredAt is dated by it, and the time filter finds it on the day of the action, not on the day of the delivery")
    void datedByTheAction() throws Exception {
        Instant threeDaysAgo = Instant.parse("2026-11-05T10:00:00Z");
        assertEquals(201, write("\"" + threeDaysAgo + "\""));
        JsonNode all = list();
        assertEquals(1, all.path("totalElements").asInt());
        assertEquals(threeDaysAgo, Instant.parse(all.path("items").get(0).path("createdAt").asText()));
        assertEquals(1, list("from", "2026-11-05T00:00:00Z", "to", "2026-11-06T00:00:00Z").path("totalElements").asInt(),
                "found on the day of the action");
        String today = Instant.now().toString();
        assertEquals(0, list("from", Instant.now().minus(Duration.ofHours(1)).toString(), "to", Instant.now().plus(Duration.ofHours(1)).toString())
                .path("totalElements").asInt(), "not found on the day of the delivery (" + today + ")");
    }

    @Test
    @DisplayName("without occurredAt the entry is dated when it arrives, as before")
    void withoutItTheEntryIsDatedByTheArrival() throws Exception {
        Instant before = Instant.now().minusSeconds(2);
        assertEquals(201, write(null));
        Instant at = Instant.parse(list().path("items").get(0).path("createdAt").asText());
        assertTrue(!at.isBefore(before) && !at.isAfter(Instant.now().plusSeconds(2)), "dated now: " + at);
    }

    @Test
    @DisplayName("an action dated more than five minutes in the future is refused (400); a small clock difference is accepted")
    void futureIsRefused() throws Exception {
        assertEquals(400, write("\"" + Instant.now().plus(Duration.ofHours(1)) + "\""));
        assertEquals(400, write("\"" + Instant.now().plus(Duration.ofDays(400)) + "\""));
        assertEquals(0, repository.count(), "nothing was stored");
        assertEquals(201, write("\"" + Instant.now().plus(Duration.ofMinutes(2)) + "\""));
        assertEquals(1, repository.count());
    }

    @Test
    @DisplayName("an occurredAt that is not a time is 400, a missing one (null) is the arrival time")
    void badValues() throws Exception {
        assertEquals(400, write("\"yesterday\""));
        assertEquals(400, write("12345.5e99"));
        assertEquals(400, write("0"), "the epoch");
        assertEquals(400, write("\"1999-12-31T23:59:59Z\""), "before the platform existed");
        assertEquals(400, write("-1"));
        assertEquals(0, repository.count());
        assertEquals(201, write("null"));
        assertEquals(1, repository.count());
    }

    @Test
    @DisplayName("a writer that sends the old body (no occurredAt) and the way the tenant relay sends it both work, and the order follows the action time")
    void orderFollowsTheActionTime() throws Exception {
        assertEquals(201, write("\"2026-11-03T00:00:00Z\""));
        assertEquals(201, write("\"2026-11-04T00:00:00Z\""));
        assertEquals(201, write("\"2026-11-02T00:00:00Z\""));
        JsonNode items = list().path("items");
        assertEquals("2026-11-04T00:00:00Z", items.get(0).path("createdAt").asText());
        assertEquals("2026-11-02T00:00:00Z", items.get(2).path("createdAt").asText());
    }
}
