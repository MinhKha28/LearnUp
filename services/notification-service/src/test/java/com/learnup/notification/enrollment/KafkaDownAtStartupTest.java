package com.learnup.notification.enrollment;

import com.learnup.notification.client.CourseDirectory;
import com.learnup.notification.client.RecipientDirectory;
import com.learnup.notification.dto.CreateNotificationRequest;
import com.learnup.notification.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Kafka is down when the service starts, and its host name does not resolve (what a stopped Compose container looks
 * like): before, the application failed with {@code No resolvable bootstrap urls} and the notification API went with
 * it. Now the service starts, the API works, and the consumer keeps trying to start in the background.
 */
@ExtendWith(OutputCaptureExtension.class)
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "learnup.enrollment-events.enabled=true",
        "spring.kafka.bootstrap-servers=kafka-that-is-down.invalid:9092",
        "learnup.enrollment-events.start-retry-interval=300ms",
        "spring.datasource.url=jdbc:h2:mem:kafka_down_at_startup;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;MODE=PostgreSQL"
})
class KafkaDownAtStartupTest {

    @Autowired
    private KafkaListenerEndpointRegistry registry;
    @Autowired
    private NotificationService notifications;

    @MockBean
    private RecipientDirectory recipients;
    @MockBean
    private CourseDirectory courses;

    @Test
    void theServiceStartsAndItsApiWorksWhileTheConsumerWaitsForKafka(CapturedOutput output) throws Exception {
        // The context is up (otherwise this test would not run). Give the starter a few pauses to try and fail.
        Thread.sleep(2500);

        assertThat(registry.getListenerContainer(EnrollmentEventListener.LISTENER_ID)).isNotNull();
        // It tried more than once, and said so without the text of the Kafka error.
        assertThat(output.getOut().split("event=enrollment_listener_start_failed", -1).length - 1).isGreaterThanOrEqualTo(2);
        assertThat(output.getOut()).contains("failure=KafkaException");
        UUID organization = UUID.randomUUID();
        UUID learner = UUID.randomUUID();
        notifications.sendNotification(new CreateNotificationRequest(organization, learner, "Title", "Text",
                "SYSTEM", "IN_APP", null));
        assertThat(notifications.getUnreadCount(learner, organization)).isEqualTo(1);
    }
}
