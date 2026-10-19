package com.learnup.identity.service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.read.ListAppender;
import com.learnup.identity.client.NotificationEmailClient;
import com.learnup.identity.client.NotificationEmailClient.DeliveryResult;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.config.PasswordRecoveryProperties;
import com.learnup.identity.dto.internal.SignInAccess;
import com.learnup.identity.exception.TenantUnavailableException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.slf4j.LoggerFactory;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.List;
import java.util.Queue;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

/** Unit-level callback/outcome coverage; separate integration tests verify actual committed rows. */
class PasswordRecoveryDeliveryTest {

    private static final UUID USER_ID = UUID.fromString("01900000-0000-7000-8000-00000000d101");
    private static final UUID TOKEN_ID = UUID.fromString("01900000-0000-7000-8000-00000000d102");
    private static final String CORRELATION_ID = "01900000-0000-7000-8000-00000000d103";
    private static final String EMAIL = "synthetic-delivery-recipient@identity-contract.invalid";
    private static final String RAW_TOKEN = "synthetic-private-delivery-reset-token";
    private static final String RECOVERY_URL = "https://learnup.example/reset-password/" + RAW_TOKEN;
    private static final String SECRET_DETAIL = "synthetic-private-exception-service-key-and-password";
    private static final Instant EXPIRY = Instant.parse("2035-01-01T00:15:00Z");

    private TaskExecutor executor;
    private RecoveryDeliveryState state;
    private TenantAccessClient tenant;
    private NotificationEmailClient notification;
    private PasswordRecoveryProperties properties;
    private PasswordRecoveryDelivery delivery;
    private Queue<Runnable> queuedTasks;
    private Logger logger;
    private Level originalLevel;
    private boolean originalAdditive;
    private ListAppender<ILoggingEvent> logs;

    @BeforeEach
    void prepareCallbackAndDependencyFixtures() {
        clearTransaction();
        executor = mock(TaskExecutor.class);
        state = mock(RecoveryDeliveryState.class);
        tenant = mock(TenantAccessClient.class);
        notification = mock(NotificationEmailClient.class);
        properties = new PasswordRecoveryProperties();
        properties.setNotificationBaseUrl("http://notification-service:8087");
        properties.setFrontendBaseUrl("https://learnup.example");
        delivery = new PasswordRecoveryDelivery(executor, state, tenant, notification, properties, true);
        queuedTasks = new ArrayDeque<>();
        doAnswer(invocation -> {
            queuedTasks.add(invocation.getArgument(0));
            return null;
        }).when(executor).execute(any(Runnable.class));
        when(state.isDeliverable(USER_ID, TOKEN_ID, EMAIL)).thenReturn(true);
        when(tenant.check(USER_ID)).thenReturn(new SignInAccess(true, "Full", null));
        when(notification.sendRecovery(EMAIL, RECOVERY_URL, EXPIRY, CORRELATION_ID)).thenReturn(DeliveryResult.SENT);

        logger = (Logger) LoggerFactory.getLogger(PasswordRecoveryDelivery.class);
        originalLevel = logger.getLevel();
        originalAdditive = logger.isAdditive();
        logger.setLevel(Level.INFO);
        logger.setAdditive(false);
        logs = new ListAppender<>();
        logs.setContext(logger.getLoggerContext());
        logs.start();
        logger.addAppender(logs);
    }

    @AfterEach
    void clearThreadTransactionStateAndCheckRedaction() {
        clearTransaction();
        logger.detachAppender(logs);
        logger.setLevel(originalLevel);
        logger.setAdditive(originalAdditive);
        logs.stop();
        String diagnostics = logs.list.stream().map(event -> event.getFormattedMessage()
                        + Arrays.deepToString(event.getArgumentArray())
                        + (event.getThrowableProxy() == null ? "" : ThrowableProxyUtil.asString(event.getThrowableProxy())))
                .reduce("", (left, right) -> left + "\n" + right);
        assertThat(diagnostics).doesNotContain(RAW_TOKEN, RECOVERY_URL, EMAIL, SECRET_DETAIL);
        assertThat(logs.list).allSatisfy(event -> assertThat(event.getThrowableProxy()).isNull());
    }

    @Test
    void requiresAnActualSynchronizedTransactionBeforeAcceptingSecretBearingWork() {
        assertThatThrownBy(this::schedule).isInstanceOf(IllegalStateException.class)
                .hasMessage("Recovery delivery requires a token transaction");
        TransactionSynchronizationManager.initSynchronization();
        assertThatThrownBy(this::schedule).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(executor, state, tenant, notification);
    }

    @Test
    void executorAndHttpRemainUnusedUntilCommitAndTheSeparateWorkerRuns() {
        beginTransaction();
        schedule();

        verifyNoInteractions(executor, state, tenant, notification);
        assertThat(queuedTasks).isEmpty();
        assertThat(TransactionSynchronizationManager.getSynchronizations()).hasSize(1);

        commitWithoutRunningWorker();

        verify(executor).execute(any(Runnable.class));
        verifyNoInteractions(state, tenant, notification);
        assertThat(queuedTasks).hasSize(1);
        when(notification.sendRecovery(EMAIL, RECOVERY_URL, EXPIRY, CORRELATION_ID)).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            assertThat(TransactionSynchronizationManager.isSynchronizationActive()).isFalse();
            return DeliveryResult.SENT;
        });

        queuedTasks.remove().run();

        var ordered = inOrder(state, tenant, notification);
        ordered.verify(state).isDeliverable(USER_ID, TOKEN_ID, EMAIL);
        ordered.verify(tenant).check(USER_ID);
        ordered.verify(state).isDeliverable(USER_ID, TOKEN_ID, EMAIL);
        ordered.verify(notification).sendRecovery(EMAIL, RECOVERY_URL, EXPIRY, CORRELATION_ID);
        verify(state, never()).revoke(any(), any());
        assertOutcome("SENT");
    }

    @Test
    void rollbackNeverSubmitsAWorkerOrSendsAnEmail() {
        beginTransaction();
        schedule();
        List<TransactionSynchronization> callbacks = TransactionSynchronizationManager.getSynchronizations();
        callbacks.forEach(callback -> callback.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
        clearTransaction();

        assertThat(queuedTasks).isEmpty();
        verifyNoInteractions(executor, state, tenant, notification);
        assertThat(logs.list).isEmpty();
    }

    @Test
    void boundedExecutorRejectionRevokesOnlyTheMatchingTokenWithoutSurfacingTheSecretException() {
        doThrow(new TaskRejectedException(SECRET_DETAIL + " " + RAW_TOKEN + " " + RECOVERY_URL))
                .when(executor).execute(any(Runnable.class));
        beginTransaction();
        schedule();

        commitWithoutRunningWorker();

        assertThat(queuedTasks).isEmpty();
        verify(state).revoke(USER_ID, TOKEN_ID);
        verifyNoMoreInteractions(state);
        verifyNoInteractions(tenant, notification);
        assertOutcome("QUEUE_REJECTED");
    }

    @ParameterizedTest
    @EnumSource(value = DeliveryResult.class, names = "SENT", mode = EnumSource.Mode.EXCLUDE)
    void everyNonSentResultRevokesOnlyThatUndeliveredLink(DeliveryResult result) {
        when(notification.sendRecovery(EMAIL, RECOVERY_URL, EXPIRY, CORRELATION_ID)).thenReturn(result);

        commitAndRunWorker();

        verify(notification).sendRecovery(EMAIL, RECOVERY_URL, EXPIRY, CORRELATION_ID);
        verify(state).revoke(USER_ID, TOKEN_ID);
        verifyNoMoreInteractions(notification);
        assertOutcome(result.name());
    }

    @Test
    void tenantDenialPreventsEmailAndRevokesTheMatchingLink() {
        when(tenant.check(USER_ID)).thenReturn(new SignInAccess(false, null, "ACCOUNT_DEACTIVATED"));

        commitAndRunWorker();

        verify(state).revoke(USER_ID, TOKEN_ID);
        verifyNoInteractions(notification);
        assertOutcome("ACCOUNT_UNAVAILABLE");
    }

    @Test
    void tenantOutagePreventsEmailAndDoesNotLogSensitiveCauseDetails() {
        when(tenant.check(USER_ID)).thenThrow(new TenantUnavailableException(
                new IllegalStateException(SECRET_DETAIL + " " + RECOVERY_URL)));

        commitAndRunWorker();

        verify(state).revoke(USER_ID, TOKEN_ID);
        verifyNoInteractions(notification);
        assertOutcome("DEPENDENCY_FAILURE");
    }

    @Test
    void alreadyObsoleteTokenIsNotSentAndCannotRevokeANewerToken() {
        when(state.isDeliverable(USER_ID, TOKEN_ID, EMAIL)).thenReturn(false);

        commitAndRunWorker();

        verify(state).isDeliverable(USER_ID, TOKEN_ID, EMAIL);
        verify(state).revoke(USER_ID, TOKEN_ID);
        verifyNoMoreInteractions(state);
        verifyNoInteractions(tenant, notification);
        assertOutcome("OBSOLETE");
    }

    @Test
    void linkSupersededDuringTenantLookupIsCheckedAgainBeforeSending() {
        when(state.isDeliverable(USER_ID, TOKEN_ID, EMAIL)).thenReturn(true, false);

        commitAndRunWorker();

        verify(state, times(2)).isDeliverable(USER_ID, TOKEN_ID, EMAIL);
        verify(tenant).check(USER_ID);
        verify(state).revoke(USER_ID, TOKEN_ID);
        verifyNoInteractions(notification);
        assertOutcome("OBSOLETE");
    }

    @Test
    void unexpectedNotificationExceptionIsContainedAndItsDetailsNeverReachLogs() {
        when(notification.sendRecovery(EMAIL, RECOVERY_URL, EXPIRY, CORRELATION_ID))
                .thenThrow(new IllegalStateException(SECRET_DETAIL + " " + RECOVERY_URL));

        commitAndRunWorker();

        verify(state).revoke(USER_ID, TOKEN_ID);
        assertOutcome("DEPENDENCY_FAILURE");
    }

    @Test
    void revocationFailureRetainsMeaningfulErrorEventWithoutItsSensitiveException() {
        when(notification.sendRecovery(EMAIL, RECOVERY_URL, EXPIRY, CORRELATION_ID)).thenReturn(DeliveryResult.FAILED);
        doThrow(new IllegalStateException(SECRET_DETAIL + " " + RAW_TOKEN)).when(state).revoke(USER_ID, TOKEN_ID);

        commitAndRunWorker();

        assertOutcome("FAILED");
        assertThat(logs.list).anySatisfy(event -> {
            assertThat(event.getLevel()).isEqualTo(Level.ERROR);
            assertThat(event.getFormattedMessage()).contains("event=password_recovery_revocation", "outcome=FAILED", CORRELATION_ID);
        });
    }

    @Test
    void disabledIsolatedTestModeDoesNotScheduleAnySecretBearingWork() {
        delivery = new PasswordRecoveryDelivery(executor, state, tenant, notification, properties, false);
        beginTransaction();
        schedule();

        assertThat(TransactionSynchronizationManager.getSynchronizations()).isEmpty();
        commitWithoutRunningWorker();

        verifyNoInteractions(executor, state, tenant, notification);
        assertOutcome("DISABLED");
    }

    @Test
    void callerSuppliedCorrelationSecretsAreNotLoggedOrForwarded() {
        beginTransaction();
        delivery.scheduleAfterCommit(USER_ID, EMAIL, TOKEN_ID, RAW_TOKEN, EXPIRY, SECRET_DETAIL);
        commitWithoutRunningWorker();
        when(notification.sendRecovery(EMAIL, RECOVERY_URL, EXPIRY, "unavailable")).thenReturn(DeliveryResult.SENT);
        queuedTasks.remove().run();
        verify(notification).sendRecovery(EMAIL, RECOVERY_URL, EXPIRY, "unavailable");
        assertThat(logs.list).singleElement().satisfies(event -> assertThat(event.getFormattedMessage())
                .contains("outcome=SENT", "correlation_id=unavailable"));
    }

    private void schedule() {
        delivery.scheduleAfterCommit(USER_ID, EMAIL, TOKEN_ID, RAW_TOKEN, EXPIRY, CORRELATION_ID);
    }

    private void beginTransaction() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        TransactionSynchronizationManager.initSynchronization();
    }

    private void commitWithoutRunningWorker() {
        List<TransactionSynchronization> callbacks = TransactionSynchronizationManager.getSynchronizations();
        callbacks.forEach(TransactionSynchronization::afterCommit);
        callbacks.forEach(callback -> callback.afterCompletion(TransactionSynchronization.STATUS_COMMITTED));
        clearTransaction();
    }

    private void commitAndRunWorker() {
        beginTransaction();
        schedule();
        commitWithoutRunningWorker();
        assertThat(queuedTasks).hasSize(1);
        queuedTasks.remove().run();
    }

    private void clearTransaction() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
        TransactionSynchronizationManager.setActualTransactionActive(false);
    }

    private void assertOutcome(String outcome) {
        assertThat(logs.list).anySatisfy(event -> assertThat(event.getFormattedMessage())
                .contains("event=password_recovery_delivery", "outcome=" + outcome, USER_ID.toString(), CORRELATION_ID));
    }
}
