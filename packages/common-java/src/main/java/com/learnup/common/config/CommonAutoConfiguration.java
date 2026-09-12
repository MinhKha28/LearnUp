package com.learnup.common.config;

import com.learnup.common.auth.JwtParser;
import com.learnup.common.auth.JwtValidator;
import com.learnup.common.event.EventPublisher;
import com.learnup.common.event.InMemoryEventPublisher;
import com.learnup.common.event.KafkaEventPublisher;
import com.learnup.common.exception.GlobalExceptionHandler;
import com.learnup.common.filter.CorrelationIdFilter;
import com.learnup.common.filter.TenantSecurityFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaTemplate;

/**
 * Spring Boot AutoConfiguration for LearnUP Common Library cross-cutting beans.
 */
@AutoConfiguration
public class CommonAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public CorrelationIdFilter correlationIdFilter() {
        return new CorrelationIdFilter();
    }

    @Bean
    @ConditionalOnMissingBean
    public TenantSecurityFilter tenantSecurityFilter() {
        return new TenantSecurityFilter();
    }

    @Bean
    @ConditionalOnMissingBean
    public GlobalExceptionHandler globalExceptionHandler() {
        return new GlobalExceptionHandler();
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(name = "jwt.secret")
    public JwtParser jwtParser(@Value("${jwt.secret}") String jwtSecret) {
        return new JwtParser(jwtSecret);
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(name = "jwt.secret")
    public JwtValidator jwtValidator(JwtParser jwtParser) {
        return new JwtValidator(jwtParser);
    }

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(KafkaTemplate.class)
    static class KafkaPublisherConfiguration {

        @Bean
        @ConditionalOnMissingBean(EventPublisher.class)
        @ConditionalOnProperty(name = "spring.kafka.bootstrap-servers")
        public EventPublisher kafkaEventPublisher(
                KafkaTemplate<String, Object> kafkaTemplate,
                @Value("${spring.application.name:learnup-service}") String appName) {
            return new KafkaEventPublisher(kafkaTemplate, appName);
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class FallbackPublisherConfiguration {

        @Bean
        @ConditionalOnMissingBean(EventPublisher.class)
        public EventPublisher fallbackEventPublisher(
                @Value("${spring.application.name:learnup-service}") String appName) {
            return new InMemoryEventPublisher(appName);
        }
    }
}
