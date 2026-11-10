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
    private final CourseDecisionEventParser decisionParser;
    private final CourseDecisionEventHandler decisionHandler;

    public CourseSubmittedEventListener(CourseSubmittedEventParser parser,
                                        CourseSubmittedEventHandler handler,
                                        CourseDecisionEventParser decisionParser,
                                        CourseDecisionEventHandler decisionHandler) {
        this.parser = parser;
        this.handler = handler;
        this.decisionParser = decisionParser;
        this.decisionHandler = decisionHandler;
    }

    @KafkaListener(
            id = LISTENER_ID,
            autoStartup = "false",
            topics = "${learnup.course-events.topic}",
            groupId = "${learnup.course-events.group-id}",
            containerFactory = "courseKafkaListenerContainerFactory")
    public void onMessage(ConsumerRecord<String, String> record) {
        // One topic carries every Course outbox event: UC20 submissions and the UC21.3 decisions (UC49 content).
        parser.parse(record.value()).ifPresent(handler::handle);
        decisionParser.parse(record.value()).ifPresent(decisionHandler::handle);
    }
}
