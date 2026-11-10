package com.learnup.notification.course;

import com.learnup.notification.enrollment.InvalidEventException;
import org.apache.kafka.common.TopicPartition;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.util.backoff.ExponentialBackOff;

@Configuration
@EnableScheduling
@ConditionalOnProperty(prefix = "learnup.course-events", name = "enabled", havingValue = "true")
public class CourseEventsKafkaConfig {

    @Bean
    public NewTopic courseSubmittedDeadLetterTopic(
            @Value("${learnup.course-events.dlt}") String topic) {
        return TopicBuilder.name(topic).partitions(3).replicas(1).build();
    }

    @Bean("courseKafkaListenerContainerFactory")
    public ConcurrentKafkaListenerContainerFactory<String, String> courseKafkaListenerContainerFactory(
            ConsumerFactory<String, String> consumerFactory,
            KafkaTemplate<String, String> template,
            @Value("${learnup.course-events.dlt}") String dlt,
            @Value("${learnup.course-events.retry-attempts:10}") int attempts,
            @Value("${learnup.course-events.retry-initial-ms:1000}") long initialMs,
            @Value("${learnup.course-events.retry-max-ms:30000}") long maxMs) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(
                template, (record, failure) -> new TopicPartition(dlt, -1));

        ExponentialBackOff backoff = new ExponentialBackOff(initialMs, 2.0);
        backoff.setMaxInterval(maxMs);
        backoff.setMaxAttempts(Math.max(0, attempts - 1));

        DefaultErrorHandler errorHandler = new DefaultErrorHandler((record, failure) ->
                recoverer.accept(record, failure), backoff);
        errorHandler.addNotRetryableExceptions(InvalidEventException.class);

        ConcurrentKafkaListenerContainerFactory<String, String> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        factory.setCommonErrorHandler(errorHandler);
        return factory;
    }
}
