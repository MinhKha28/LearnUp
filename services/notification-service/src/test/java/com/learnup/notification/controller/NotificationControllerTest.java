package com.learnup.notification.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.HeaderConstants;
import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.dto.SendEmailRequest;
import com.learnup.notification.repository.EmailLogRepository;
import com.learnup.notification.repository.NotificationRepository;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NotificationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private EmailLogRepository emailLogRepository;

    @BeforeEach
    void setUp() {
        notificationRepository.deleteAll();
        emailLogRepository.deleteAll();
    }

    @Test
    @DisplayName("Should send in-app notification and query user notifications and unread count")
    void shouldSendAndQueryNotifications() throws Exception {
        UUID orgId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        CreateNotificationRequest request = new CreateNotificationRequest(
                orgId,
                userId,
                "Welcome to LearnUP",
                "Your account has been successfully provisioned.",
                "INFO",
                "IN_APP",
                "{\"type\":\"onboarding\"}"
        );

        String createRes = mockMvc.perform(post("/api/notifications/send")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").isNotEmpty())
                .andExpect(jsonPath("$.data.recipientUserId").value(userId.toString()))
                .andExpect(jsonPath("$.data.isRead").value(false))
                .andReturn().getResponse().getContentAsString();

        String notificationId = objectMapper.readTree(createRes).path("data").path("id").asText();

        // Check unread count
        mockMvc.perform(get("/api/notifications/unread-count")
                        .header(HeaderConstants.X_USER_ID, userId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.unreadCount").value(1));

        // Query user notifications
        mockMvc.perform(get("/api/notifications")
                        .header(HeaderConstants.X_USER_ID, userId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items", hasSize(1)))
                .andExpect(jsonPath("$.data.items[0].id").value(notificationId));

        // Mark as read
        mockMvc.perform(patch("/api/notifications/" + notificationId + "/read")
                        .header(HeaderConstants.X_USER_ID, userId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.isRead").value(true));

        // Check unread count after read
        mockMvc.perform(get("/api/notifications/unread-count")
                        .header(HeaderConstants.X_USER_ID, userId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.unreadCount").value(0));
    }

    @Test
    @DisplayName("Should send transactional email and record delivery log")
    void shouldSendEmailAndRecordLog() throws Exception {
        SendEmailRequest emailReq = new SendEmailRequest(
                "learner@learnup.com",
                "Course Enrollment Confirmation",
                "You have been enrolled into Java Microservices.",
                "COURSE_ENROLLED"
        );

        mockMvc.perform(post("/api/notifications/email/send")
                        .header("X-Internal-Key", "notification-test-only-internal-key-32bytes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(emailReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").isNotEmpty())
                .andExpect(jsonPath("$.data.recipientEmail").value("learner@learnup.com"))
                .andExpect(jsonPath("$.data.status").value("SIMULATED"));

        // Query logs
        mockMvc.perform(get("/api/notifications/email/logs")
                        .header("X-Internal-Key", "notification-test-only-internal-key-32bytes")
                        .param("recipientEmail", "learner@learnup.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items", hasSize(1)));
    }

    @Test
    @DisplayName("Should support /api/v1 route prefix for notification and email endpoints")
    void shouldSupportV1RoutePrefix() throws Exception {
        UUID orgId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        CreateNotificationRequest request = new CreateNotificationRequest(
                orgId,
                userId,
                "V1 Test Notification",
                "Testing /api/v1 routes",
                "INFO",
                "IN_APP",
                "{}"
        );

        mockMvc.perform(post("/api/v1/notifications/send")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/v1/notifications")
                        .header(HeaderConstants.X_USER_ID, userId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items", hasSize(1)));

        SendEmailRequest emailReq = new SendEmailRequest(
                "v1recipient@learnup.com",
                "V1 Subject",
                "V1 Body",
                "TEST"
        );

        mockMvc.perform(post("/api/v1/notifications/email/send")
                        .header("X-Internal-Key", "notification-test-only-internal-key-32bytes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(emailReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/v1/notifications/email/logs")
                        .header("X-Internal-Key", "notification-test-only-internal-key-32bytes")
                        .param("recipientEmail", "v1recipient@learnup.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items", hasSize(1)));
    }

    private String send(UUID orgId, UUID userId, String title) throws Exception {
        CreateNotificationRequest request = new CreateNotificationRequest(
                orgId, userId, title, "Body of " + title, "INFO", "IN_APP", null);
        String body = mockMvc.perform(post("/api/v1/notifications/send")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("data").path("id").asText();
    }

    @Test
    @DisplayName("UC49: a signed-in user (X-User-ID from the Gateway) cannot create notifications or use the email endpoints")
    void shouldRefuseServiceOnlyEndpointsForUsers() throws Exception {
        UUID someone = UUID.randomUUID();
        CreateNotificationRequest request = new CreateNotificationRequest(
                null, someone, "Fake", "A fake message", "INFO", "IN_APP", null);

        mockMvc.perform(post("/api/v1/notifications/send")
                        .header(HeaderConstants.X_USER_ID, UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/notifications/email/send")
                        .header(HeaderConstants.X_USER_ID, UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new SendEmailRequest("victim@learnup.com", "Subject", "Body", "TEST"))))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/notifications/email/logs")
                        .header(HeaderConstants.X_USER_ID, UUID.randomUUID().toString()))
                .andExpect(status().isForbidden());

        // nothing was created
        mockMvc.perform(get("/api/v1/notifications")
                        .header(HeaderConstants.X_USER_ID, someone.toString()))
                .andExpect(jsonPath("$.data.items", hasSize(0)));
    }

    @Test
    @DisplayName("UC49: the list, the unread count and mark-as-read stay inside the Organization of the caller (platform notices included)")
    void shouldScopeNotificationsByOrganization() throws Exception {
        UUID orgA = UUID.randomUUID();
        UUID orgB = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        String inA = send(orgA, userId, "In organization A");
        String inB = send(orgB, userId, "In organization B");
        send(null, userId, "From the platform");

        // in organization A: its own notification and the platform notice, not the one of B
        mockMvc.perform(get("/api/v1/notifications")
                        .header(HeaderConstants.X_USER_ID, userId.toString())
                        .header(HeaderConstants.X_ORGANIZATION_ID, orgA.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items", hasSize(2)))
                .andExpect(jsonPath("$.data.items[*].title", containsInAnyOrder("In organization A", "From the platform")));

        mockMvc.perform(get("/api/v1/notifications/unread-count")
                        .header(HeaderConstants.X_USER_ID, userId.toString())
                        .header(HeaderConstants.X_ORGANIZATION_ID, orgA.toString()))
                .andExpect(jsonPath("$.data.unreadCount").value(2));

        mockMvc.perform(get("/api/v1/notifications")
                        .param("unreadOnly", "true")
                        .header(HeaderConstants.X_USER_ID, userId.toString())
                        .header(HeaderConstants.X_ORGANIZATION_ID, orgA.toString()))
                .andExpect(jsonPath("$.data.items", hasSize(2)));

        // a notification of another Organization cannot be marked as read from this one
        mockMvc.perform(patch("/api/v1/notifications/" + inB + "/read")
                        .header(HeaderConstants.X_USER_ID, userId.toString())
                        .header(HeaderConstants.X_ORGANIZATION_ID, orgA.toString()))
                .andExpect(status().isNotFound());

        mockMvc.perform(patch("/api/v1/notifications/" + inA + "/read")
                        .header(HeaderConstants.X_USER_ID, userId.toString())
                        .header(HeaderConstants.X_ORGANIZATION_ID, orgA.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isRead").value(true));

        mockMvc.perform(get("/api/v1/notifications/unread-count")
                        .header(HeaderConstants.X_USER_ID, userId.toString())
                        .header(HeaderConstants.X_ORGANIZATION_ID, orgA.toString()))
                .andExpect(jsonPath("$.data.unreadCount").value(1));

        // an invalid Organization header is refused
        mockMvc.perform(get("/api/v1/notifications")
                        .header(HeaderConstants.X_USER_ID, userId.toString())
                        .header(HeaderConstants.X_ORGANIZATION_ID, "not-a-uuid"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("UC49: notifications are listed newest first, and opening one again keeps its first read time")
    void shouldListNewestFirstAndKeepFirstReadTime() throws Exception {
        UUID userId = UUID.randomUUID();
        send(null, userId, "First");
        Thread.sleep(20);
        String second = send(null, userId, "Second");

        mockMvc.perform(get("/api/v1/notifications")
                        .header(HeaderConstants.X_USER_ID, userId.toString()))
                .andExpect(jsonPath("$.data.items[0].title").value("Second"))
                .andExpect(jsonPath("$.data.items[1].title").value("First"));

        String first = mockMvc.perform(patch("/api/v1/notifications/" + second + "/read")
                        .header(HeaderConstants.X_USER_ID, userId.toString()))
                .andReturn().getResponse().getContentAsString();
        Thread.sleep(20);
        String again = mockMvc.perform(patch("/api/v1/notifications/" + second + "/read")
                        .header(HeaderConstants.X_USER_ID, userId.toString()))
                .andReturn().getResponse().getContentAsString();

        // the database keeps microseconds, so the two answers are compared to the millisecond
        java.time.Instant firstReadAt = java.time.Instant.parse(objectMapper.readTree(first).path("data").path("readAt").asText());
        java.time.Instant againReadAt = java.time.Instant.parse(objectMapper.readTree(again).path("data").path("readAt").asText());
        org.junit.jupiter.api.Assertions.assertEquals(
                firstReadAt.truncatedTo(java.time.temporal.ChronoUnit.MILLIS),
                againReadAt.truncatedTo(java.time.temporal.ChronoUnit.MILLIS));
    }
}
