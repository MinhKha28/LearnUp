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
 * {@link com.learnup.notification.config.EnrollmentEventsKafkaConfig}. The container commits the offsets after this
 * method has returned for the records it polled (default ack mode BATCH, not manual), and an event that fails is
 * retried or sent to the dead-letter topic by the error handler first.
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

    /** The id is how {@link EnrollmentEventListenerStarter} finds the container. */
    public static final String LISTENER_ID = "enrollment-events-listener";

    // autoStartup = false: the starter starts the container and starts it again when the broker could not be reached,
    // so a Kafka that is down when this service starts does not stop the service (and its REST API) from starting.
    @KafkaListener(id = LISTENER_ID, autoStartup = "false", topics = "${learnup.enrollment-events.topic}",
            groupId = "${spring.kafka.consumer.group-id}")
    public void onMessage(ConsumerRecord<String, String> record) {
        // An invalid message throws InvalidEventException: it goes to the dead-letter topic without a retry.
        // The payload is never logged.
        parser.parse(record.value()).ifPresentOrElse(
                handler::handle,
                () -> log.debug("event=enrollment_event_ignored reason=TYPE_NOT_HANDLED partition={} offset={}",
                        record.partition(), record.offset()));
    }
}
