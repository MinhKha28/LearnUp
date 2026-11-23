package com.learnup.notification.enrollment;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.kafka.listener.MessageListenerContainer;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "learnup.submission-finalized", name = "enabled", havingValue = "true")
public class SubmissionFinalizedEventListenerStarter {
    private static final Logger log = LoggerFactory.getLogger(SubmissionFinalizedEventListenerStarter.class);
    private final KafkaListenerEndpointRegistry registry;

    public SubmissionFinalizedEventListenerStarter(KafkaListenerEndpointRegistry registry) {
        this.registry = registry;
    }

    @Scheduled(fixedDelayString = "${learnup.submission-finalized.start-retry-ms:10000}")
    public void ensureStarted() {
        MessageListenerContainer container = registry.getListenerContainer(SubmissionFinalizedEventListener.LISTENER_ID);
        if (container == null || container.isRunning()) return;
        try {
            container.start();
        } catch (RuntimeException failure) {
            log.warn("event=submission_finalized_listener_start_failed reason=KAFKA_UNAVAILABLE");
            try {
                container.stop();
            } catch (RuntimeException ignored) {
                // Retry at the next scheduled tick.
            }
        }
    }
}
