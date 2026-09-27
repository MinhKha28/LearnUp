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
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(emailReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").isNotEmpty())
                .andExpect(jsonPath("$.data.recipientEmail").value("learner@learnup.com"))
                .andExpect(jsonPath("$.data.status").value("SENT"));

        // Query logs
        mockMvc.perform(get("/api/notifications/email/logs")
                        .param("recipientEmail", "learner@learnup.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items", hasSize(1)));
    }
}
