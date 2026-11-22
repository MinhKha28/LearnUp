package com.learnup.notification.config;

import java.util.Map;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class SubmissionFinalizedRecoveryTimingTest {
    @Test void defaultRecoveryEnvelopeFitsFiveMinutePollInterval() {
        assertThatCode(() -> SubmissionFinalizedRecoveryTiming.validate(Map.of(), Map.of(), 30000, 5000))
                .doesNotThrowAnyException();
    }

    @Test void exactBoundaryIsUnsafeAndNamesEveryBudgetComponent() {
        assertThatThrownBy(() -> SubmissionFinalizedRecoveryTiming.validate(Map.of(),
                Map.of(ConsumerConfig.MAX_POLL_INTERVAL_MS_CONFIG, "250000"), 30000, 5000))
                .hasMessageContaining("max.block.ms=60000", "dltConfirmationTimeoutMs=125000", "recoveryWaitMs=30000",
                        "pollTimeoutMs=5000", "processingHeadroomMs=30000", "max.poll.interval.ms=250000");
        assertThatCode(() -> SubmissionFinalizedRecoveryTiming.validate(Map.of(),
                Map.of(ConsumerConfig.MAX_POLL_INTERVAL_MS_CONFIG, 250001), 30000, 5000))
                .doesNotThrowAnyException();
    }

    @Test void producerOverridesAndConfirmationMinimumAreIncluded() {
        Map<String, Object> producer = Map.of(ProducerConfig.MAX_BLOCK_MS_CONFIG, "1000",
                ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, "2000");
        assertThatThrownBy(() -> SubmissionFinalizedRecoveryTiming.validate(producer,
                Map.of(ConsumerConfig.MAX_POLL_INTERVAL_MS_CONFIG, 67000), 1000, 5000))
                .hasMessageContaining("max.block.ms=1000", "dltConfirmationTimeoutMs=30000", "recoveryWaitMs=1000");
        assertThatThrownBy(() -> SubmissionFinalizedRecoveryTiming.validate(
                Map.of(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, 200000), Map.of(), 30000, 5000))
                .hasMessageContaining("dltConfirmationTimeoutMs=205000");
    }

    @Test void overflowingBudgetFailsWithEveryComponentNamed() {
        assertThatThrownBy(() -> SubmissionFinalizedRecoveryTiming.validate(Map.of(), Map.of(), Long.MAX_VALUE, 5000))
                .hasMessageContaining("recovery envelope overflowed", "max.block.ms=60000", "dltConfirmationTimeoutMs=125000",
                        "recoveryWaitMs=9223372036854775807", "pollTimeoutMs=5000", "processingHeadroomMs=30000",
                        "max.poll.interval.ms=300000");
    }

    @SuppressWarnings("unchecked")
    private ApplicationContextRunner context(boolean enabled) {
        var consumers = mock(ConsumerFactory.class);
        when(consumers.getConfigurationProperties()).thenReturn(Map.of(ConsumerConfig.MAX_POLL_INTERVAL_MS_CONFIG, 200000));
        var producers = mock(ProducerFactory.class);
        when(producers.getConfigurationProperties()).thenReturn(Map.of());
        var template = new KafkaTemplate<String, String>(producers);
        return new ApplicationContextRunner()
                .withUserConfiguration(SubmissionFinalizedEventsKafkaConfig.class, SubmissionFinalizedEventsProperties.class)
                .withPropertyValues("learnup.submission-finalized.enabled=" + enabled,
                        "learnup.frontend-base-url=https://frontend.example")
                .withBean(ConsumerFactory.class, () -> consumers)
                .withBean(KafkaTemplate.class, () -> template);
    }

    @Test void unsafeEnabledConsumerFailsStartup() {
        context(true).run(context -> assertThat(context).hasFailed()
                .getFailure().hasRootCauseInstanceOf(IllegalArgumentException.class)
                .hasStackTraceContaining("UNSAFE_SUBMISSION_FINALIZED_RECOVERY_TIMING", "max.poll.interval.ms=200000"));
    }

    @Test void disabledConsumerDoesNotValidateRecoveryTiming() {
        context(false).run(context -> assertThat(context).hasNotFailed()
                .doesNotHaveBean("submissionFinalizedKafkaListenerContainerFactory"));
    }
}
