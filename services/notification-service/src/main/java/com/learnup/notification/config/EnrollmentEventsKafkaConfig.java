package com.learnup.notification.config;

import com.learnup.notification.enrollment.InvalidEventException;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.common.TopicPartition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
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
@ConditionalOnProperty(prefix = "learnup.enrollment-events", name = "enabled", havingValue = "true")
public class EnrollmentEventsKafkaConfig {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentEventsKafkaConfig.class);

    /** The dead-letter topic is made here when the broker does not have it yet; the three partitions match the topic. */
    @Bean
    public NewTopic enrollmentEventsDeadLetterTopic(EnrollmentEventsProperties properties) {
        return TopicBuilder.name(properties.getDeadLetterTopic()).partitions(3).replicas(1).build();
    }

    /** Boot puts a CommonErrorHandler bean on the listener container factory. */
    @Bean
    public CommonErrorHandler enrollmentEventsErrorHandler(KafkaTemplate<String, String> template,
                                                           EnrollmentEventsProperties properties) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(template,
                // Partition -1: the broker chooses, so the dead-letter topic need not have as many partitions.
                (record, exception) -> new TopicPartition(properties.getDeadLetterTopic(), -1));

        // retryAttempts counts the first try, so the pauses are one fewer.
        ExponentialBackOff backOff = new ExponentialBackOff(properties.getRetryInitialBackoff().toMillis(), 2.0);
        backOff.setMaxInterval(properties.getRetryMaxBackoff().toMillis());
        backOff.setMaxAttempts(Math.max(0, properties.getRetryAttempts() - 1));

        DefaultErrorHandler handler = new DefaultErrorHandler((record, exception) -> {
            // Only the place of the message and the kind of failure: never the payload or the text of the error.
            log.error("event=enrollment_event_dead_lettered topic={} partition={} offset={} failure={}",
                    record.topic(), record.partition(), record.offset(), exception.getClass().getSimpleName());
            recoverer.accept(record, exception);
        }, backOff);
        handler.addNotRetryableExceptions(InvalidEventException.class);
        return handler;
    }
}
