package com.learnup.notification.course;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "learnup.course-events", name = "enabled", havingValue = "true")
public class CourseSubmittedEventListener {
    public static final String LISTENER_ID = "course-submitted-events-listener";

    private final CourseSubmittedEventParser parser;
    private final CourseSubmittedEventHandler handler;
    private final CourseOwnershipTransferredEventParser transferParser;
    private final CourseOwnershipTransferredEventHandler transferHandler;

    public CourseSubmittedEventListener(CourseSubmittedEventParser parser,
                                        CourseSubmittedEventHandler handler,
                                        CourseOwnershipTransferredEventParser transferParser,
                                        CourseOwnershipTransferredEventHandler transferHandler) {
        this.parser = parser;
        this.handler = handler;
        this.transferParser = transferParser;
        this.transferHandler = transferHandler;
    }

    @KafkaListener(
            id = LISTENER_ID,
            autoStartup = "false",
            topics = "${learnup.course-events.topic}",
            groupId = "${learnup.course-events.group-id}",
            containerFactory = "courseKafkaListenerContainerFactory")
    public void onMessage(ConsumerRecord<String, String> record) {
        parser.parse(record.value()).ifPresent(handler::handle);
        transferParser.parse(record.value()).ifPresent(transferHandler::handle);
    }
}
