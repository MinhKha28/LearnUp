package com.learnup.notification.enrollment;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.kafka.listener.MessageListenerContainer;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Starts the consumer of the enrollment events, and starts it again until it runs.
 * <p>
 * Spring would start the listener while the application starts, and when the broker cannot be reached at that moment
 * (for example Kafka is down and its host name does not resolve: {@code ConfigException: No resolvable bootstrap urls})
 * the whole service stopped, including the notification API that has nothing to do with Kafka. The listener is
 * therefore not auto-started; this class starts it, and while it is not running tries again at a fixed pause. A broker
 * that goes away while the consumer runs is handled by the consumer itself.
 */
@Component
@ConditionalOnProperty(prefix = "learnup.enrollment-events", name = "enabled", havingValue = "true")
public class EnrollmentEventListenerStarter {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentEventListenerStarter.class);

    private final KafkaListenerEndpointRegistry registry;

    public EnrollmentEventListenerStarter(KafkaListenerEndpointRegistry registry) {
        this.registry = registry;
    }

    @Scheduled(fixedDelayString = "#{@enrollmentEventsProperties.startRetryInterval.toMillis()}")
    public void ensureStarted() {
        MessageListenerContainer container = registry.getListenerContainer(EnrollmentEventListener.LISTENER_ID);
        if (container == null || container.isRunning()) {
            return;
        }
        try {
            container.start();
            log.info("event=enrollment_listener_started");
        } catch (RuntimeException e) {
            // Only the kind of failure: the text of a Kafka error can carry host names and settings.
            log.warn("event=enrollment_listener_start_failed failure={} will_retry=true", e.getClass().getSimpleName());
            stopQuietly(container);
        }
    }

    /** A start that failed half way can leave the container marked as running; stopped, the next pause starts it cleanly. */
    private static void stopQuietly(MessageListenerContainer container) {
        try {
            container.stop();
        } catch (RuntimeException ignored) {
            // Nothing else to do: the next pause tries again.
        }
    }
}
