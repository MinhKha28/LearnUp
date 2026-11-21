package com.learnup.notification.config;

import com.learnup.notification.enrollment.InvalidEventException;
import com.learnup.notification.enrollment.PermanentDeliveryException;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.common.TopicPartition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.util.backoff.ExponentialBackOff;

@Configuration
@EnableScheduling
@ConditionalOnProperty(prefix = "learnup.submission-finalized", name = "enabled", havingValue = "true")
public class SubmissionFinalizedEventsKafkaConfig {
    @Bean
    public NewTopic submissionFinalizedDeadLetterTopic(SubmissionFinalizedEventsProperties properties) {
        return TopicBuilder.name(properties.getDlt()).partitions(properties.getDltPartitions())
                .replicas(properties.getDltReplicas()).build();
    }

    @Bean("submissionFinalizedKafkaListenerContainerFactory")
    public ConcurrentKafkaListenerContainerFactory<String, String> submissionFinalizedKafkaListenerContainerFactory(
            ConsumerFactory<String, String> consumers, KafkaTemplate<String, String> template,
            SubmissionFinalizedEventsProperties properties) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(
                template, (record, failure) -> new TopicPartition(properties.getDlt(), -1));
        recoverer.setFailIfSendResultIsError(true);
        ExponentialBackOff backoff = new ExponentialBackOff(properties.getRetryInitialMs(), 2.0);
        backoff.setMaxInterval(properties.getRetryMaxMs());
        backoff.setMaxAttempts(properties.getRetryAttempts() - 1);
        DefaultErrorHandler handler = new DefaultErrorHandler(recoverer, backoff);
        handler.setResetStateOnRecoveryFailure(false);
        handler.addNotRetryableExceptions(InvalidEventException.class, PermanentDeliveryException.class);
        ConcurrentKafkaListenerContainerFactory<String, String> factory = new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumers);
        factory.setCommonErrorHandler(handler);
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.BATCH);
        factory.getContainerProperties().setDeliveryAttemptHeader(true);
        return factory;
    }
}
