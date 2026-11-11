package com.learnup.notification.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.HeaderConstants;
import com.learnup.notification.entity.Notification;
import com.learnup.notification.repository.EmailLogRepository;
import com.learnup.notification.repository.NotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * UC49 list contract: chronological (newest first) regardless of client sort, stable pagination on equal
 * timestamps, bounded page size, and no producer-internal metadata in the recipient response.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NotificationListContractIntegrationTest {

    private static final String INTERNAL_KEY = "notification-test-only-internal-key-32bytes";
    private static final String LIST = "/api/v1/notifications";
    private static final Instant BASE = Instant.parse("2026-11-01T08:00:00Z");

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private NotificationRepository notifications;
    @Autowired private EmailLogRepository emailLogs;

    private final UUID org = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();

    @BeforeEach
    void clean() {
        notifications.deleteAll();
        emailLogs.deleteAll();
    }

    private static RequestPostProcessor gateway(UUID user, UUID organization) {
        return request -> {
            request.addHeader(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY);
            request.addHeader(HeaderConstants.X_USER_ID, user.toString());
            request.addHeader(HeaderConstants.X_USER_ROLE, "LEARNER");
            request.addHeader(HeaderConstants.X_ORGANIZATION_ID, organization.toString());
            return request;
        };
    }

    private UUID stored(String title, Instant createdAt, boolean read, String metadata) {
        Notification n = new Notification(null, org, alice, title, "Body", "INFO", "IN_APP",
                read, read ? createdAt : null, metadata, createdAt);
        return notifications.saveAndFlush(n).getId();
    }

    private JsonNode list(String query) throws Exception {
        String body = mockMvc.perform(get(LIST + query).with(gateway(alice, org)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("data");
    }

    private static List<String> titles(JsonNode page) {
        List<String> titles = new ArrayList<>();
        page.path("items").forEach(item -> titles.add(item.path("title").asText()));
        return titles;
    }

    @Test
    @DisplayName("UC49: newest first, and a client-supplied sort cannot reorder the list")
    void newestFirstIgnoringClientSort() throws Exception {
        stored("Oldest", BASE, false, null);
        stored("Newest", BASE.plus(2, ChronoUnit.HOURS), false, null);
        stored("Middle", BASE.plus(1, ChronoUnit.HOURS), true, null);

        assertThat(titles(list(""))).containsExactly("Newest", "Middle", "Oldest");
        assertThat(titles(list("?sort=createdAt,asc"))).containsExactly("Newest", "Middle", "Oldest");
        assertThat(titles(list("?sort=title,asc"))).containsExactly("Newest", "Middle", "Oldest");
        assertThat(titles(list("?unreadOnly=true&sort=createdAt,asc"))).containsExactly("Newest", "Oldest");
    }

    @Test
    @DisplayName("UC49: notifications created at the same instant are paged without repeats or gaps")
    void stablePaginationOnEqualTimestamps() throws Exception {
        Set<UUID> created = new HashSet<>();
        for (int i = 0; i < 7; i++) {
            created.add(stored("Same " + i, BASE, false, null));
        }

        Set<String> seen = new HashSet<>();
        List<String> firstPass = new ArrayList<>();
        for (int page = 0; page < 4; page++) {
            list("?page=" + page + "&size=2").path("items").forEach(item -> {
                firstPass.add(item.path("id").asText());
                seen.add(item.path("id").asText());
            });
        }
        assertThat(firstPass).hasSize(7).doesNotHaveDuplicates();
        assertThat(seen).containsExactlyInAnyOrderElementsOf(created.stream().map(UUID::toString).toList());

        List<String> secondPass = new ArrayList<>();
        for (int page = 0; page < 4; page++) {
            list("?page=" + page + "&size=2").path("items").forEach(item -> secondPass.add(item.path("id").asText()));
        }
        assertThat(secondPass).containsExactlyElementsOf(firstPass);
    }

    @Test
    @DisplayName("UC49: page size is capped at 100; a negative page or zero size falls back to the first default page")
    void pageSizeIsBounded() throws Exception {
        for (int i = 0; i < 105; i++) {
            stored("N" + i, BASE.plusSeconds(i), false, null);
        }

        JsonNode capped = list("?size=5000");
        assertThat(capped.path("items").size()).isEqualTo(100);
        assertThat(capped.path("size").asInt()).isEqualTo(100);
        assertThat(capped.path("totalElements").asLong()).isEqualTo(105);

        // Spring's resolver turns a negative page into 0 and a size below 1 into the default size.
        JsonNode first = list("?page=-3&size=0");
        assertThat(first.path("page").asInt()).isZero();
        assertThat(first.path("items").size()).isEqualTo(20);
        assertThat(titles(first).getFirst()).isEqualTo("N104");
    }

    @Test
    @DisplayName("UC49: producer metadata is not returned to the recipient, in the list or after mark-as-read")
    void metadataIsNotExposed() throws Exception {
        UUID id = stored("With metadata", BASE, false, "{\"courseId\":\"" + UUID.randomUUID() + "\"}");

        mockMvc.perform(get(LIST).with(gateway(alice, org)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items", hasSize(1)))
                .andExpect(jsonPath("$.data.items[0].title").value("With metadata"))
                .andExpect(jsonPath("$.data.items[0].metadata").doesNotExist());
        mockMvc.perform(patch(LIST + "/" + id + "/read").with(gateway(alice, org)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isRead").value(true))
                .andExpect(jsonPath("$.data.metadata").doesNotExist());

        assertThat(notifications.findById(id).orElseThrow().getMetadata()).contains("courseId");
    }
}
