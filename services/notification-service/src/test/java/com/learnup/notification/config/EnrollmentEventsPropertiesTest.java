package com.learnup.notification.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class EnrollmentEventsPropertiesTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(Config.class);

    @EnableConfigurationProperties(EnrollmentEventsProperties.class)
    static class Config {
    }

    @Test
    void theConsumerIsOffAndTheDefaultsAreTheAgreedOnes() {
        runner.run(context -> {
            EnrollmentEventsProperties properties = context.getBean(EnrollmentEventsProperties.class);
            assertThat(properties.isEnabled()).isFalse();
            assertThat(properties.getTopic()).isEqualTo("learnup.learning.enrollment-events");
            assertThat(properties.getDeadLetterTopic()).isEqualTo("learnup.learning.enrollment-events.DLT");
            assertThat(properties.getMaxAge()).isEqualTo(Duration.ofHours(72));
            assertThat(properties.getRetryAttempts()).isEqualTo(5);
            assertThat(properties.getDefaultTimeZone()).isEqualTo("Asia/Ho_Chi_Minh");
            assertThat(properties.getClaimLease()).isEqualTo(Duration.ofMinutes(2));
            assertThat(properties.getStartRetryInterval()).isEqualTo(Duration.ofSeconds(10));
            assertThat(properties.getDeadLetterPartitions()).isEqualTo(3);
            assertThat(properties.getDeadLetterReplicas()).isEqualTo((short) 1);
        });
    }

    @Test
    void theValuesCanBeSetByConfiguration() {
        runner.withPropertyValues(
                        "learnup.enrollment-events.enabled=true",
                        "learnup.enrollment-events.topic=custom.topic",
                        "learnup.enrollment-events.max-age=36h",
                        "learnup.enrollment-events.retry-attempts=3",
                        "learnup.enrollment-events.retry-initial-backoff=500ms",
                        "learnup.enrollment-events.retry-max-backoff=10s",
                        "learnup.enrollment-events.claim-lease=45s",
                        "learnup.enrollment-events.start-retry-interval=3s",
                        "learnup.enrollment-events.dead-letter-partitions=6",
                        "learnup.enrollment-events.dead-letter-replicas=3")
                .run(context -> {
                    EnrollmentEventsProperties properties = context.getBean(EnrollmentEventsProperties.class);
                    assertThat(properties.isEnabled()).isTrue();
                    assertThat(properties.getDeadLetterTopic()).isEqualTo("custom.topic.DLT");
                    assertThat(properties.getMaxAge()).isEqualTo(Duration.ofHours(36));
                    assertThat(properties.getRetryAttempts()).isEqualTo(3);
                    assertThat(properties.getRetryInitialBackoff()).isEqualTo(Duration.ofMillis(500));
                    assertThat(properties.getRetryMaxBackoff()).isEqualTo(Duration.ofSeconds(10));
                    assertThat(properties.getClaimLease()).isEqualTo(Duration.ofSeconds(45));
                    assertThat(properties.getStartRetryInterval()).isEqualTo(Duration.ofSeconds(3));
                    assertThat(properties.getDeadLetterPartitions()).isEqualTo(6);
                    assertThat(properties.getDeadLetterReplicas()).isEqualTo((short) 3);
                });
    }
}
