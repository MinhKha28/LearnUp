package com.learnup.notification.config;

import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import com.learnup.notification.enrollment.PermanentDeliveryException;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.listener.ConsumerAwareRecordRecoverer;
import org.springframework.kafka.listener.MessageListenerContainer;
import org.springframework.util.backoff.FixedBackOff;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class DltFailureBackoffErrorHandlerTest {
    private static final long WAIT_MS = 1000;
    private final ConsumerRecord<String, String> record = new ConsumerRecord<>("source", 0, 1, "key", "value");
    private final RuntimeException publicationFailure = new IllegalStateException("DLT_UNAVAILABLE");
    private final Exception listenerFailure = new IllegalStateException("TRANSIENT");

    private MessageListenerContainer runningContainer() {
        var container = mock(MessageListenerContainer.class);
        when(container.isRunning()).thenReturn(true);
        return container;
    }

    private DltFailureBackoffErrorHandler handler(ConsumerAwareRecordRecoverer publisher, long waitMs) {
        var handler = new DltFailureBackoffErrorHandler(publisher, new FixedBackOff(0, 0), waitMs);
        handler.setResetStateOnRecoveryFailure(false);
        return handler;
    }

    @Test void publicationFailureWaitsAndRethrowsTheOriginalException() {
        var handler = handler((record, consumer, failure) -> { throw publicationFailure; }, WAIT_MS);
        long start = System.nanoTime();
        assertThatThrownBy(() -> handler.recoveryWithBackoff().recovered(record, listenerFailure,
                runningContainer(), null)).isSameAs(publicationFailure);
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isGreaterThanOrEqualTo(Duration.ofMillis(WAIT_MS));
    }

    @Test void successfulPublicationDoesNotWait() throws Exception {
        var publisher = mock(ConsumerAwareRecordRecoverer.class);
        var handler = handler(publisher, Duration.ofSeconds(30).toMillis());
        var container = runningContainer();
        long start = System.nanoTime();
        assertThat(handler.recoveryWithBackoff().recovered(record, listenerFailure, container, null)).isTrue();
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(1));
        verify(publisher).accept(record, null, listenerFailure);
        verifyNoInteractions(container);
    }

    @Test void ordinaryTransientBackoffDoesNotAddARecoveryWait() throws Exception {
        var publisher = mock(ConsumerAwareRecordRecoverer.class);
        var handler = new DltFailureBackoffErrorHandler(publisher, new FixedBackOff(1, 1), WAIT_MS);
        long start = System.nanoTime();
        assertThat(handler.recoveryWithBackoff().recovered(record, listenerFailure, runningContainer(), null)).isFalse();
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(1));
        verifyNoInteractions(publisher);
    }

    @Test void permanentFailureAlsoWaitsOnlyWhenPublicationFails() {
        var handler = handler((record, consumer, failure) -> { throw publicationFailure; }, WAIT_MS);
        handler.addNotRetryableExceptions(PermanentDeliveryException.class);
        long start = System.nanoTime();
        assertThatThrownBy(() -> handler.recoveryWithBackoff().recovered(record,
                new PermanentDeliveryException("TENANT_REJECTED"), runningContainer(), null)).isSameAs(publicationFailure);
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isGreaterThanOrEqualTo(Duration.ofMillis(WAIT_MS));
    }

    @Test void containerStopEndsTheWaitPromptly() throws Exception {
        var publicationStarted = new CountDownLatch(1);
        var running = new AtomicBoolean(true);
        var container = mock(MessageListenerContainer.class);
        when(container.isRunning()).thenAnswer(invocation -> running.get());
        var handler = handler((record, consumer, failure) -> {
            publicationStarted.countDown();
            throw publicationFailure;
        }, Duration.ofSeconds(30).toMillis());
        var completion = CompletableFuture.runAsync(() -> assertThatThrownBy(() ->
                handler.recoveryWithBackoff().recovered(record, listenerFailure, container, null))
                .isSameAs(publicationFailure));
        assertThat(publicationStarted.await(2, TimeUnit.SECONDS)).isTrue();
        long start = System.nanoTime();
        running.set(false);
        completion.get(2, TimeUnit.SECONDS);
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(1));
    }

    @Test void interruptionIsPreservedAndOriginalPublicationFailureIsRethrown() throws Exception {
        var publicationStarted = new CountDownLatch(1);
        var interrupted = new AtomicBoolean();
        var thrown = new AtomicReference<Throwable>();
        var handler = handler((record, consumer, failure) -> {
            publicationStarted.countDown();
            throw publicationFailure;
        }, Duration.ofSeconds(30).toMillis());
        var worker = new Thread(() -> {
            try {
                handler.recoveryWithBackoff().recovered(record, listenerFailure, runningContainer(), null);
            } catch (Throwable failure) {
                thrown.set(failure);
                interrupted.set(Thread.currentThread().isInterrupted());
            }
        });
        worker.start();
        try {
            assertThat(publicationStarted.await(2, TimeUnit.SECONDS)).isTrue();
            worker.interrupt();
            worker.join(2000);
            assertThat(worker.isAlive()).isFalse();
            assertThat(thrown.get()).isSameAs(publicationFailure);
            assertThat(interrupted).isTrue();
        } finally {
            worker.interrupt();
            worker.join(2000);
        }
    }
}
