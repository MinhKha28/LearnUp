package com.learnup.notification.config;

import java.time.Duration;
import java.util.Map;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.springframework.kafka.support.KafkaUtils;

final class SubmissionFinalizedRecoveryTiming {
    static final long DLT_CONFIRMATION_BUFFER_MS = Duration.ofSeconds(5).toMillis();
    static final long MIN_DLT_CONFIRMATION_TIMEOUT_MS = Duration.ofSeconds(30).toMillis();
    // An allowance for processing, not an enforced listener deadline.
    static final long PROCESSING_HEADROOM_MS = Duration.ofSeconds(30).toMillis();

    private SubmissionFinalizedRecoveryTiming() { }

    static void validate(Map<String, Object> producer, Map<String, Object> consumer,
            long recoveryWaitMs, long pollTimeoutMs) {
        long maxBlockMs = configuredLong(producer, ProducerConfig.MAX_BLOCK_MS_CONFIG,
                ProducerConfig.configDef().defaultValues());
        long confirmationMs = KafkaUtils.determineSendTimeout(producer, DLT_CONFIRMATION_BUFFER_MS,
                MIN_DLT_CONFIRMATION_TIMEOUT_MS).toMillis();
        long maxPollMs = configuredLong(consumer, ConsumerConfig.MAX_POLL_INTERVAL_MS_CONFIG,
                ConsumerConfig.configDef().defaultValues());
        String details = "max.block.ms=" + maxBlockMs + ", dltConfirmationTimeoutMs=" + confirmationMs
                + ", recoveryWaitMs=" + recoveryWaitMs + ", pollTimeoutMs=" + pollTimeoutMs
                + ", processingHeadroomMs=" + PROCESSING_HEADROOM_MS + ", max.poll.interval.ms=" + maxPollMs;
        long envelopeMs;
        try {
            envelopeMs = Math.addExact(Math.addExact(maxBlockMs, confirmationMs),
                    Math.addExact(Math.addExact(recoveryWaitMs, pollTimeoutMs), PROCESSING_HEADROOM_MS));
        } catch (ArithmeticException overflow) {
            throw new IllegalArgumentException("UNSAFE_SUBMISSION_FINALIZED_RECOVERY_TIMING: " + details
                    + "; recovery envelope overflowed", overflow);
        }
        if (maxBlockMs < 0 || recoveryWaitMs < 1 || pollTimeoutMs < 0 || envelopeMs >= maxPollMs) {
            throw new IllegalArgumentException("UNSAFE_SUBMISSION_FINALIZED_RECOVERY_TIMING: " + details
                    + "; recovery envelope must be strictly less than max.poll.interval.ms");
        }
    }

    private static long configuredLong(Map<String, Object> properties, String key, Map<String, Object> defaults) {
        Object value = properties.getOrDefault(key, defaults.get(key));
        return Long.parseLong(value.toString());
    }
}
