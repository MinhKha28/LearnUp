package com.learnup.notification.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.HeaderConstants;
import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.entity.Notification;
import com.learnup.notification.repository.EmailLogRepository;
import com.learnup.notification.repository.NotificationRepository;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * UC49 trust boundary: the recipient is always the Gateway-authenticated user; every in-app
 * request needs the internal key; nothing is taken from request parameters.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NotificationAuthorizationIntegrationTest {

    private static final String INTERNAL_KEY = "notification-test-only-internal-key-32bytes";
    private static final String LIST = "/api/v1/notifications";
    private static final String COUNT = "/api/v1/notifications/unread-count";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private NotificationRepository notifications;
    @Autowired private EmailLogRepository emailLogs;

    private final UUID orgA = UUID.randomUUID();
    private final UUID orgB = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID mallory = UUID.randomUUID();

    @BeforeEach
    void clean() {
        notifications.deleteAll();
        emailLogs.deleteAll();
    }

    /** Exactly what the Gateway forwards for a signed-in user. */
    private static RequestPostProcessor gateway(UUID user, UUID organization) {
        return request -> {
            request.addHeader(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY);
            request.addHeader(HeaderConstants.X_USER_ID, user.toString());
            request.addHeader(HeaderConstants.X_USER_ROLE, "LEARNER");
            if (organization != null) {
                request.addHeader(HeaderConstants.X_ORGANIZATION_ID, organization.toString());
            }
            return request;
        };
    }

    private static RequestPostProcessor service() {
        return request -> {
            request.addHeader(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY);
            return request;
        };
    }

    private UUID stored(UUID organization, UUID recipient, String title) {
        Notification n = new Notification(null, organization, recipient, title, "Body", "INFO", "IN_APP",
                false, null, null, null);
        return notifications.saveAndFlush(n).getId();
    }

    private String sendBody(UUID organization, UUID recipient) throws Exception {
        return objectMapper.writeValueAsString(new CreateNotificationRequest(
                organization, recipient, "Title", "Message", "INFO", "IN_APP", null));
    }

    // ---- legitimate Gateway requests -------------------------------------------------------

    @Test
    @DisplayName("Gateway user: list, unread count and mark-as-read work for own notifications")
    void legitimateGatewayRequests() throws Exception {
        UUID mine = stored(orgA, alice, "Mine");
        stored(null, alice, "Platform notice");

        mockMvc.perform(get(LIST).with(gateway(alice, orgA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items", hasSize(2)))
                .andExpect(jsonPath("$.data.items[*].title", containsInAnyOrder("Mine", "Platform notice")));
        mockMvc.perform(get(COUNT).with(gateway(alice, orgA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.unreadCount").value(2))
                .andExpect(jsonPath("$.data.userId").value(alice.toString()));
        mockMvc.perform(patch(LIST + "/" + mine + "/read").with(gateway(alice, orgA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isRead").value(true));
        mockMvc.perform(get("/api/notifications/unread-count").with(gateway(alice, orgA)))
                .andExpect(jsonPath("$.data.unreadCount").value(1));
    }

    // ---- internal key ----------------------------------------------------------------------

    @ParameterizedTest(name = "{0} without the internal key is refused")
    @ValueSource(strings = {"list", "count", "read", "send"})
    void missingInternalKeyIsUnauthorized(String operation) throws Exception {
        UUID mine = stored(orgA, alice, "Mine");
        MockHttpServletRequestBuilder request = switch (operation) {
            case "list" -> get(LIST);
            case "count" -> get(COUNT);
            case "read" -> patch(LIST + "/" + mine + "/read");
            default -> post(LIST + "/send").contentType(MediaType.APPLICATION_JSON).content(sendBody(orgA, alice));
        };
        mockMvc.perform(request
                        .header(HeaderConstants.X_USER_ID, alice.toString())
                        .header(HeaderConstants.X_ORGANIZATION_ID, orgA.toString()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
        assertThat(notifications.findById(mine).orElseThrow().isRead()).isFalse();
        assertThat(notifications.count()).isEqualTo(1);
    }

    @ParameterizedTest(name = "wrong internal key ''{0}'' is refused")
    @ValueSource(strings = {"wrong-key-of-sufficient-length-0123456789", "notification-test-only-internal-key-32byteS", " "})
    void wrongInternalKeyIsUnauthorized(String key) throws Exception {
        mockMvc.perform(get(LIST)
                        .header(HeaderConstants.X_INTERNAL_KEY, key)
                        .header(HeaderConstants.X_USER_ID, alice.toString()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void anonymousRequestWithoutAnyHeaderCannotCreateNotifications() throws Exception {
        mockMvc.perform(post(LIST + "/send").contentType(MediaType.APPLICATION_JSON).content(sendBody(null, alice)))
                .andExpect(status().isUnauthorized());
        assertThat(notifications.count()).isZero();
    }

    // ---- principal ------------------------------------------------------------------------

    @Test
    @DisplayName("A keyed request without a user identity cannot read anyone's notifications")
    void missingIdentityIsUnauthorized() throws Exception {
        stored(null, alice, "Mine");
        mockMvc.perform(get(LIST).with(service())).andExpect(status().isUnauthorized());
        mockMvc.perform(get(COUNT).with(service())).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest(name = "malformed X-User-ID ''{0}'' is refused")
    @ValueSource(strings = {"not-a-uuid", "", "  ", "123", "01900000-0000-7000-8000-00000000000g"})
    void malformedUserIdIsUnauthorized(String userId) throws Exception {
        mockMvc.perform(get(LIST)
                        .header(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY)
                        .header(HeaderConstants.X_USER_ID, userId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void malformedOrganizationIsUnauthorized() throws Exception {
        mockMvc.perform(get(LIST).with(gateway(alice, null)).header(HeaderConstants.X_ORGANIZATION_ID, "not-a-uuid"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Partial user context without X-User-ID is not treated as a service call")
    void partialUserContextIsUnauthorized() throws Exception {
        mockMvc.perform(post(LIST + "/send").with(service())
                        .header(HeaderConstants.X_ORGANIZATION_ID, orgA.toString())
                        .contentType(MediaType.APPLICATION_JSON).content(sendBody(orgA, alice)))
                .andExpect(status().isUnauthorized());
        assertThat(notifications.count()).isZero();
    }

    // ---- the old ?userId= fallback --------------------------------------------------------

    @Test
    @DisplayName("?userId= never selects the recipient: refused with a valid user, unauthorized without one")
    void userIdQueryParameterIsNeverTrusted() throws Exception {
        stored(orgA, alice, "Alice's secret");

        for (String path : new String[] {LIST, COUNT}) {
            mockMvc.perform(get(path).with(gateway(mallory, orgA)).param("userId", alice.toString()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.data").doesNotExist());
            mockMvc.perform(get(path).with(service()).param("userId", alice.toString()))
                    .andExpect(status().isUnauthorized());
            mockMvc.perform(get(path).param("userId", alice.toString()))
                    .andExpect(status().isUnauthorized());
            mockMvc.perform(get(path)
                            .header(HeaderConstants.X_INTERNAL_KEY, INTERNAL_KEY)
                            .header(HeaderConstants.X_USER_ID, "not-a-uuid")
                            .param("userId", alice.toString()))
                    .andExpect(status().isUnauthorized());
        }
    }

    // ---- cross-user and cross-Organization ------------------------------------------------

    @Test
    @DisplayName("Another user's notifications are invisible and cannot be marked as read")
    void crossUserAccessIsDenied() throws Exception {
        UUID alicesNotification = stored(orgA, alice, "For Alice");

        mockMvc.perform(get(LIST).with(gateway(mallory, orgA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items", hasSize(0)));
        mockMvc.perform(get(COUNT).with(gateway(mallory, orgA)))
                .andExpect(jsonPath("$.data.unreadCount").value(0));
        mockMvc.perform(patch(LIST + "/" + alicesNotification + "/read").with(gateway(mallory, orgA)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.message").value("Notification not found"));

        assertThat(notifications.findById(alicesNotification).orElseThrow().isRead()).isFalse();
    }

    @Test
    @DisplayName("Notifications of another Organization are invisible and cannot be modified")
    void crossOrganizationAccessIsDenied() throws Exception {
        stored(orgA, alice, "In A");
        UUID inB = stored(orgB, alice, "In B");

        mockMvc.perform(get(LIST).with(gateway(alice, orgA)))
                .andExpect(jsonPath("$.data.items", hasSize(1)))
                .andExpect(jsonPath("$.data.items[0].title").value("In A"));
        mockMvc.perform(patch(LIST + "/" + inB + "/read").with(gateway(alice, orgA)))
                .andExpect(status().isNotFound());
        assertThat(notifications.findById(inB).orElseThrow().isRead()).isFalse();
    }

    @Test
    @DisplayName("A caller without an Organization (platform Admin) sees platform notices only")
    void callerWithoutOrganizationSeesOnlyPlatformNotices() throws Exception {
        stored(null, alice, "Platform notice");
        UUID tagged = stored(orgA, alice, "Organization notice");

        mockMvc.perform(get(LIST).with(gateway(alice, null)))
                .andExpect(jsonPath("$.data.items", hasSize(1)))
                .andExpect(jsonPath("$.data.items[0].title").value("Platform notice"));
        mockMvc.perform(get(COUNT).with(gateway(alice, null)))
                .andExpect(jsonPath("$.data.unreadCount").value(1));
        mockMvc.perform(patch(LIST + "/" + tagged + "/read").with(gateway(alice, null)))
                .andExpect(status().isNotFound());
    }

    // ---- service-only creation ------------------------------------------------------------

    @Test
    @DisplayName("Services create notifications with the key; signed-in users cannot")
    void sendIsServiceOnly() throws Exception {
        mockMvc.perform(post("/api/notifications/send").with(service())
                        .contentType(MediaType.APPLICATION_JSON).content(sendBody(orgA, alice)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.recipientUserId").value(alice.toString()));
        mockMvc.perform(post(LIST + "/send").with(gateway(mallory, orgA))
                        .contentType(MediaType.APPLICATION_JSON).content(sendBody(orgA, alice)))
                .andExpect(status().isForbidden());
        assertThat(notifications.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("The email API keeps its own guard: key required, user context refused")
    void emailWorkflowIsUnchanged() throws Exception {
        String email = "{\"recipientEmail\":\"learner@learnup.test\",\"subject\":\"S\",\"body\":\"B\",\"templateCode\":\"TEST\"}";
        mockMvc.perform(post(LIST + "/email/send").with(service()).contentType(MediaType.APPLICATION_JSON).content(email))
                .andExpect(status().isCreated());
        mockMvc.perform(post(LIST + "/email/send").with(gateway(alice, orgA)).contentType(MediaType.APPLICATION_JSON).content(email))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(LIST + "/email/send").contentType(MediaType.APPLICATION_JSON).content(email))
                .andExpect(status().isForbidden());
    }
}
