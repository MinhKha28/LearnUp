package com.learnup.notification.config;

import com.learnup.notification.enrollment.InvalidEventException;
import org.apache.kafka.common.TopicPartition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.ExponentialBackOff;

/**
 * What happens when an event cannot be handled: a service that does not answer is tried again with a growing pause;
 * after the last try, and at once for a message that is not a valid event, the message is published to the
 * dead-letter topic and the offset moves on, so one bad message never holds up the ones behind it.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(prefix = "learnup.enrollment-events", name = "enabled", havingValue = "true")
public class EnrollmentEventsKafkaConfig {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentEventsKafkaConfig.class);

    // Deployment provisions DLTs; this configuration only publishes failed records.
    @Bean
    public CommonErrorHandler enrollmentEventsErrorHandler(KafkaTemplate<String, String> template,
                                                           EnrollmentEventsProperties properties) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(template,
                // Partition -1: the broker chooses, so the dead-letter topic need not have as many partitions.
                (record, exception) -> new TopicPartition(properties.deadLetterTopicOf(record.topic()), -1));

        // retryAttempts counts the first try, so the pauses are one fewer.
        ExponentialBackOff backOff = new ExponentialBackOff(properties.getRetryInitialBackoff().toMillis(), 2.0);
        backOff.setMaxInterval(properties.getRetryMaxBackoff().toMillis());
        backOff.setMaxAttempts(Math.max(0, properties.getRetryAttempts() - 1));

        DefaultErrorHandler handler = new DefaultErrorHandler((record, exception) -> {
            // When the publish fails it throws and the container tries the record again: nothing is claimed as dead-lettered.
            recoverer.accept(record, exception);
            // Only the place of the message and the kind of failure: never the payload or the text of the error.
            log.error("event=enrollment_event_dead_lettered topic={} partition={} offset={} failure={}",
                    record.topic(), record.partition(), record.offset(), exception.getClass().getSimpleName());
        }, backOff);
        handler.addNotRetryableExceptions(InvalidEventException.class);
        return handler;
    }
}
