package com.learnup.notification.enrollment;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

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
        parser.parse(record.value()).ifPresent(handler::handle);
    }
}
