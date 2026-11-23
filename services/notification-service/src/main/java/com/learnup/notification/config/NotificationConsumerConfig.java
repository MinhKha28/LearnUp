package com.learnup.notification.config;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.springframework.boot.autoconfigure.kafka.DefaultKafkaConsumerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
public class NotificationConsumerConfig {
    @Bean
    public DefaultKafkaConsumerFactoryCustomizer disableConsumerTopicCreation() {
        return factory -> factory.updateConfigs(Map.of(ConsumerConfig.ALLOW_AUTO_CREATE_TOPICS_CONFIG, false));
    }
}
