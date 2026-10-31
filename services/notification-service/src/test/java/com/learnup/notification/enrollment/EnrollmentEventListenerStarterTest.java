package com.learnup.notification.enrollment;

import org.apache.kafka.common.config.ConfigException;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.kafka.listener.MessageListenerContainer;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The consumer is started again, at each pause, until it runs; it is never started twice and never takes the service down. */
class EnrollmentEventListenerStarterTest {

    private final KafkaListenerEndpointRegistry registry = mock(KafkaListenerEndpointRegistry.class);
    private final MessageListenerContainer container = mock(MessageListenerContainer.class);
    private final EnrollmentEventListenerStarter starter = new EnrollmentEventListenerStarter(registry);

    @Test
    void aBrokerThatCannotBeReachedIsTriedAgainAtTheNextPauseUntilItWorks() {
        when(registry.getListenerContainer(EnrollmentEventListener.LISTENER_ID)).thenReturn(container);
        when(container.isRunning()).thenReturn(false);
        doThrow(new ConfigException("No resolvable bootstrap urls given in bootstrap.servers"))
                .doThrow(new IllegalStateException("still down"))
                .doNothing()
                .when(container).start();

        assertThatCode(starter::ensureStarted).doesNotThrowAnyException();
        assertThatCode(starter::ensureStarted).doesNotThrowAnyException();
        starter.ensureStarted();

        verify(container, times(3)).start();
    }

    @Test
    void aConsumerThatRunsIsLeftAlone() {
        when(registry.getListenerContainer(EnrollmentEventListener.LISTENER_ID)).thenReturn(container);
        when(container.isRunning()).thenReturn(true);

        starter.ensureStarted();
        starter.ensureStarted();

        verify(container, never()).start();
    }

    @Test
    void aConsumerThatStoppedIsStartedAgain() {
        when(registry.getListenerContainer(EnrollmentEventListener.LISTENER_ID)).thenReturn(container);
        when(container.isRunning()).thenReturn(true).thenReturn(false);
        doNothing().when(container).start();

        starter.ensureStarted();
        starter.ensureStarted();

        verify(container, times(1)).start();
    }

    @Test
    void aMissingContainerIsNotAnError() {
        when(registry.getListenerContainer(anyString())).thenReturn(null);

        assertThatCode(starter::ensureStarted).doesNotThrowAnyException();
    }
}
