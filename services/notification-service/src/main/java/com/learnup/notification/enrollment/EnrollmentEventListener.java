package com.learnup.notification.enrollment;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Reads the learning enrollment topic. All it does is hand the message to the parser and the handler: what to do when
 * that fails (try again with a pause, then the dead-letter topic) is decided by the error handler of
 * {@link com.learnup.notification.config.EnrollmentEventsKafkaConfig}, and an offset is committed only after the event
 * was handled or sent to the dead-letter topic.
 */
@Component
@ConditionalOnProperty(prefix = "learnup.enrollment-events", name = "enabled", havingValue = "true")
public class EnrollmentEventListener {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentEventListener.class);

    private final EnrollmentEventParser parser;
    private final EnrollmentEventHandler handler;

    public EnrollmentEventListener(EnrollmentEventParser parser, EnrollmentEventHandler handler) {
        this.parser = parser;
        this.handler = handler;
    }

    @KafkaListener(topics = "${learnup.enrollment-events.topic}", groupId = "${spring.kafka.consumer.group-id}")
    public void onMessage(ConsumerRecord<String, String> record) {
        // An invalid message throws InvalidEventException: it goes to the dead-letter topic without a retry.
        // The payload is never logged.
        parser.parse(record.value()).ifPresentOrElse(
                handler::handle,
                () -> log.debug("event=enrollment_event_ignored reason=TYPE_NOT_HANDLED partition={} offset={}",
                        record.partition(), record.offset()));
    }
}
