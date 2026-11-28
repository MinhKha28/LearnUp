package com.learnup.notification.course;

import com.learnup.notification.repository.NotificationRepository;
import com.learnup.notification.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.UUID;

import static org.mockito.Mockito.reset;

/**
 * Runs the Flyway schema on H2 in PostgreSQL mode, or on a real PostgreSQL database when
 * COURSE_DELIVERY_TEST_POSTGRES_URL, _USER and _PASSWORD are set.
 */
@SpringBootTest(properties = {
        "spring.flyway.enabled=true", "spring.jpa.hibernate.ddl-auto=validate",
        "learnup.frontend-base-url=https://learnup.example",
        "learnup.enrollment-events.enabled=false", "learnup.course-events.enabled=false",
        "learnup.submission-finalized.enabled=false"
})
@ActiveProfiles("test")
abstract class CourseDeliveryDatabaseTest {
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        String postgres = System.getenv("COURSE_DELIVERY_TEST_POSTGRES_URL");
        registry.add("spring.datasource.url", () -> postgres == null
                ? "jdbc:h2:mem:course_delivery_it;DB_CLOSE_DELAY=-1;MODE=PostgreSQL;LOCK_TIMEOUT=10000" : postgres);
        if (postgres != null) {
            registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
            registry.add("spring.datasource.username", () -> System.getenv("COURSE_DELIVERY_TEST_POSTGRES_USER"));
            registry.add("spring.datasource.password", () -> System.getenv("COURSE_DELIVERY_TEST_POSTGRES_PASSWORD"));
            registry.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
        }
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired NotificationRepository notificationRows;
    @SpyBean NotificationService notificationService;

    @BeforeEach
    void resetNotificationSpy() {
        reset(notificationService);
    }

    long notices(UUID recipient) {
        return notificationRows.findByRecipientUserIdOrderByCreatedAtDesc(recipient, Pageable.unpaged()).getTotalElements();
    }

    String status(CourseDeliveryTable table, UUID eventId, UUID recipient, String channel) {
        return jdbc.queryForObject("SELECT status FROM " + table.tableName()
                + " WHERE event_id = ? AND recipient_user_id = ? AND channel = ?", String.class, eventId, recipient, channel);
    }

    int attempts(CourseDeliveryTable table, UUID eventId, UUID recipient, String channel) {
        return jdbc.queryForObject("SELECT attempts FROM " + table.tableName()
                + " WHERE event_id = ? AND recipient_user_id = ? AND channel = ?", Integer.class, eventId, recipient, channel);
    }

    /** Makes the current claim look abandoned, as if its consumer stopped more than one lease ago. */
    void expireClaim(CourseDeliveryTable table, UUID eventId, UUID recipient, String channel) {
        jdbc.update("UPDATE " + table.tableName() + " SET claimed_at = claimed_at - INTERVAL '10' MINUTE"
                + " WHERE event_id = ? AND recipient_user_id = ? AND channel = ?", eventId, recipient, channel);
    }
}
