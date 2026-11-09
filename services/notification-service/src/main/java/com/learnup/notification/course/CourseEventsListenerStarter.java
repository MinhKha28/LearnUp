package com.learnup.notification.course;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.kafka.listener.MessageListenerContainer;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "learnup.course-events", name = "enabled", havingValue = "true")
public class CourseEventsListenerStarter {
    private static final Logger log = LoggerFactory.getLogger(CourseEventsListenerStarter.class);
    private final KafkaListenerEndpointRegistry registry;

    public CourseEventsListenerStarter(KafkaListenerEndpointRegistry registry) {
        this.registry = registry;
    }

    @Scheduled(fixedDelayString = "${learnup.course-events.start-retry-ms:10000}")
    public void ensureStarted() {
        MessageListenerContainer container =
                registry.getListenerContainer(CourseSubmittedEventListener.LISTENER_ID);
        if (container == null || container.isRunning()) return;
        try {
            container.start();
        } catch (RuntimeException error) {
            log.warn("event=course_listener_start_failed error_type={}",
                    error.getClass().getSimpleName());
            try {
                container.stop();
            } catch (RuntimeException ignored) {
                // The next scheduled attempt will retry.
            }
        }
    }
}
