package com.learnup.notification.enrollment;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.kafka.support.KafkaHeaders;

import java.nio.ByteBuffer;

@Component
@ConditionalOnProperty(prefix = "learnup.submission-finalized", name = "enabled", havingValue = "true")
public class SubmissionFinalizedEventListener {
    public static final String LISTENER_ID = "submission-finalized-events-listener";
    private final SubmissionFinalizedEventParser parser;
    private final SubmissionFinalizedEventHandler handler;

    public SubmissionFinalizedEventListener(SubmissionFinalizedEventParser parser, SubmissionFinalizedEventHandler handler) {
        this.parser = parser;
        this.handler = handler;
    }

    @KafkaListener(id = LISTENER_ID, autoStartup = "false", topics = "${learnup.submission-finalized.topic}",
            groupId = "${learnup.submission-finalized.group-id}",
            containerFactory = "submissionFinalizedKafkaListenerContainerFactory")
    public void onMessage(ConsumerRecord<String, String> record) {
        var attempt = record.headers().lastHeader(KafkaHeaders.DELIVERY_ATTEMPT);
        if (attempt == null || attempt.value() == null || attempt.value().length != Integer.BYTES) {
            throw new InvalidEventException("INVALID_DELIVERY_ATTEMPT");
        }
        int deliveryAttempt = ByteBuffer.wrap(attempt.value()).getInt();
        if (deliveryAttempt < 1) throw new InvalidEventException("INVALID_DELIVERY_ATTEMPT");
        parser.parse(record.value()).ifPresent(event -> handler.handle(event, deliveryAttempt));
    }
}
