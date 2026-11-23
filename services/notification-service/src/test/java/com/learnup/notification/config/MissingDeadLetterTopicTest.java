package com.learnup.notification.config;

import com.learnup.notification.course.CourseEventsKafkaConfig;
import com.learnup.notification.enrollment.InvalidEventException;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.errors.UnknownTopicOrPartitionException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.MessageListenerContainer;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.*;

class MissingDeadLetterTopicTest {
    @ParameterizedTest
    @ValueSource(strings = {"enrollment", "peer-review", "course"})
    @SuppressWarnings({"unchecked", "rawtypes"})
    void missingDltPublicationCannotRecoverSourceRecord(String listener) {
        var template = mock(KafkaTemplate.class);
        var producerFactory = mock(ProducerFactory.class);
        when(template.getProducerFactory()).thenReturn(producerFactory);
        when(producerFactory.getConfigurationProperties()).thenReturn(Map.of("delivery.timeout.ms", 1000));
        when(template.send(any(ProducerRecord.class))).thenReturn(
                CompletableFuture.failedFuture(new UnknownTopicOrPartitionException("TEST_DLT_MISSING")));
        CommonErrorHandler handler;
        var properties = new EnrollmentEventsProperties();
        String topic = listener.equals("peer-review") ? properties.getPeerReviewTopic() : properties.getTopic();
        if (listener.equals("course")) {
            topic = "test.course";
            var consumers = mock(ConsumerFactory.class);
            var factory = new CourseEventsKafkaConfig().courseKafkaListenerContainerFactory(
                    consumers, template, "test.course.DLT", 1, 1, 1);
            handler = (CommonErrorHandler) ReflectionTestUtils.getField(factory, "commonErrorHandler");
        } else {
            properties.setRetryAttempts(1);
            handler = new EnrollmentEventsKafkaConfig().enrollmentEventsErrorHandler(template, properties);
        }
        var consumer = mock(Consumer.class);
        var container = mock(MessageListenerContainer.class);
        when(container.getContainerProperties()).thenReturn(new ContainerProperties(topic));
        when(container.isRunning()).thenReturn(true);
        var record = new ConsumerRecord<>(topic, 0, 7L, "learner", "poison");
        CommonErrorHandler selected = handler;
        assertThatThrownBy(() -> selected.handleRemaining(new InvalidEventException("TEST_INVALID"),
                List.of(record), consumer, container)).isInstanceOf(RuntimeException.class);
        verify(template).send(any(ProducerRecord.class));
        verify(consumer, never()).commitSync(anyMap());
    }
}
