package com.learnup.notification.enrollment;

import org.junit.jupiter.api.Test;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.kafka.listener.MessageListenerContainer;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class SubmissionFinalizedEventListenerStarterTest {
    @Test void retriesStartupThenLeavesARunningContainerAlone() {
        var registry = mock(KafkaListenerEndpointRegistry.class);
        var container = mock(MessageListenerContainer.class);
        when(registry.getListenerContainer(SubmissionFinalizedEventListener.LISTENER_ID)).thenReturn(container);
        doThrow(new IllegalStateException("down")).doNothing().when(container).start();
        var starter = new SubmissionFinalizedEventListenerStarter(registry);
        assertThatCode(starter::ensureStarted).doesNotThrowAnyException();
        starter.ensureStarted();
        when(container.isRunning()).thenReturn(true);
        starter.ensureStarted();
        verify(container, times(2)).start();
        verify(container).stop();
    }

    @Test void missingContainerDoesNotFailTheService() {
        var starter = new SubmissionFinalizedEventListenerStarter(mock(KafkaListenerEndpointRegistry.class));
        assertThatCode(starter::ensureStarted).doesNotThrowAnyException();
    }
}
