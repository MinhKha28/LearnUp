package com.learnup.notification.config;

import java.util.List;

import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.listener.ConsumerAwareRecordRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.listener.ListenerUtils;
import org.springframework.kafka.listener.MessageListenerContainer;
import org.springframework.kafka.listener.RecoveryStrategy;
import org.springframework.kafka.listener.SeekUtils;
import org.springframework.util.backoff.BackOff;

/** Keeps exhausted retry state while slowing only failed dead-letter publication. */
class DltFailureBackoffErrorHandler extends DefaultErrorHandler {
    private final long recoveryWaitMs;

    DltFailureBackoffErrorHandler(ConsumerAwareRecordRecoverer publisher, BackOff backOff, long recoveryWaitMs) {
        super(markPublicationFailures(publisher), backOff);
        this.recoveryWaitMs = recoveryWaitMs;
    }

    /** Non-seeking recovery bypasses the DLT publication-failure wait. */
    @Override
    public void setSeekAfterError(boolean seekAfterError) {
        if (!seekAfterError) {
            throw new IllegalArgumentException("DLT recovery back-off requires seekAfterError=true; keep seeking enabled or add recovery-wait support to handleOne before disabling it");
        }
        super.setSeekAfterError(true);
    }

    // Mirrors Spring Kafka 3.2.4 DefaultErrorHandler.handleRemaining; recheck upstream behaviour when upgrading Spring Kafka.
    @Override
    public void handleRemaining(Exception exception, List<ConsumerRecord<?, ?>> records,
            Consumer<?, ?> consumer, MessageListenerContainer container) {
        SeekUtils.seekOrRecover(exception, records, consumer, container, isCommitRecovered(),
                recoveryWithBackoff(), this.logger, getLogLevel());
    }

    RecoveryStrategy recoveryWithBackoff() {
        RecoveryStrategy tracker = getFailureTracker();
        return (record, exception, container, consumer) -> {
            try {
                return tracker.recovered(record, exception, container, consumer);
            } catch (PublicationFailure failure) {
                try {
                    ListenerUtils.stoppableSleep(container, recoveryWaitMs);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                }
                throw failure.original;
            }
        };
    }

    private static ConsumerAwareRecordRecoverer markPublicationFailures(ConsumerAwareRecordRecoverer publisher) {
        return (record, consumer, exception) -> {
            try {
                publisher.accept(record, consumer, exception);
            } catch (RuntimeException failure) {
                throw new PublicationFailure(failure);
            }
        };
    }

    private static final class PublicationFailure extends RuntimeException {
        private final RuntimeException original;

        private PublicationFailure(RuntimeException original) {
            super(original);
            this.original = original;
        }
    }
}
