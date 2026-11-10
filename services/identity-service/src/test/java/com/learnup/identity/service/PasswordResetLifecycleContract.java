package com.learnup.identity.service;

import com.learnup.common.exception.BusinessException;
import com.learnup.common.security.UserRole;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.domain.PasswordResetToken;
import com.learnup.identity.domain.RefreshToken;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.ChangePasswordRequest;
import com.learnup.identity.dto.ForgotPasswordRequest;
import com.learnup.identity.dto.LoginRequest;
import com.learnup.identity.dto.RefreshTokenRequest;
import com.learnup.identity.dto.ResetPasswordRequest;
import com.learnup.identity.dto.internal.SetCredentialsRequest;
import com.learnup.identity.dto.internal.SignInAccess;
import com.learnup.identity.exception.TenantUnavailableException;
import com.learnup.identity.repository.LoginThrottleRepository;
import com.learnup.identity.repository.PasswordResetTokenRepository;
import com.learnup.identity.repository.RefreshTokenRepository;
import com.learnup.identity.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.aopalliance.intercept.MethodInterceptor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Role;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.when;

/**
 * Persistence-backed contract shared by H2 and the opt-in disposable PostgreSQL suite.
 * No test-wide transaction: each service call commits/rolls back independently, including workers.
 */
@Import(PasswordResetLifecycleContract.RepositoryObservationConfiguration.class)
public abstract class PasswordResetLifecycleContract {

    private static final String INITIAL_PASSWORD = "SyntheticInitialPassword!27";
    private static final String RESET_PASSWORD = "SyntheticRecoveryPassword!28";
    private static final String CHANGED_PASSWORD = "SyntheticChangedPassword!29";
    private static final String PROVISIONED_PASSWORD = "SyntheticProvisionedPassword!30";
    private static final String WORKER_PREFIX = "password-reset-contract-";

    @Autowired
    protected AuthService authService;
    @Autowired
    protected UserRepository users;
    @Autowired
    protected PasswordResetTokenRepository resetTokens;
    @Autowired
    protected RefreshTokenRepository refreshTokens;
    @Autowired
    private LoginThrottleRepository loginThrottles;
    @Autowired
    protected PasswordEncoder passwordEncoder;
    @Autowired
    private EntityManager entityManager;
    @Autowired
    private PlatformTransactionManager transactionManager;
    @MockBean
    protected TenantAccessClient tenantAccessClient;
    @Autowired
    private RepositoryObservation observations;

    @BeforeEach
    void preparePersistedFixtures() {
        when(tenantAccessClient.check(any())).thenReturn(new SignInAccess(true, "Full", null));
        observations.clear();
        loginThrottles.deleteAll();
        resetTokens.deleteAll();
        refreshTokens.deleteAll();
        users.deleteAll();
    }

    @Test
    void validResetIsSingleUseAndRevokesEverySiblingAndRefreshSession() {
        User user = createUser();
        String rawToken = "synthetic-valid-recovery-token";
        createResetToken(user, rawToken, Instant.now().plusSeconds(600), false);
        createResetToken(user, "synthetic-live-sibling", Instant.now().plusSeconds(600), false);
        createResetToken(user, "synthetic-used-sibling", Instant.now().plusSeconds(600), true);
        createResetToken(user, "synthetic-expired-sibling", Instant.now().minusSeconds(60), false);
        createRefreshToken(user, "synthetic-refresh-session-one");
        createRefreshToken(user, "synthetic-refresh-session-two");

        reset(rawToken, RESET_PASSWORD);

        assertPassword(user, RESET_PASSWORD);
        assertThat(resetTokens.count()).isZero();
        assertThat(refreshTokens.count()).isZero();
        assertThatThrownBy(() -> reset(rawToken, CHANGED_PASSWORD))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Invalid, expired, or already used password reset token");
        assertPassword(user, RESET_PASSWORD);
        assertThat(users.findById(user.getId()).orElseThrow().isEnabled()).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"unknown", "expired", "used", "revoked"})
    void unusableTokensDoNotMutatePasswordOrSessions(String state) {
        User user = createUser();
        String rawToken = "synthetic-rejected-token-" + state;
        if (!"unknown".equals(state)) {
            PasswordResetToken token = createResetToken(user, rawToken,
                    "expired".equals(state) ? Instant.now().minusSeconds(1) : Instant.now().plusSeconds(600),
                    "used".equals(state));
            if ("revoked".equals(state)) {
                resetTokens.deleteById(token.getId());
            }
        }
        createRefreshToken(user, "synthetic-session-preserved-on-rejection");

        assertThatThrownBy(() -> reset(rawToken, RESET_PASSWORD))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Invalid, expired, or already used password reset token");

        assertPassword(user, INITIAL_PASSWORD);
        assertThat(refreshTokens.count()).isEqualTo(1);
    }

    @ParameterizedTest
    @CsvSource({"-1, 0", "0, 0", "1, 1"})
    void atomicConsumptionRequiresStrictlyFutureExpiryAtDatabasePrecision(long offsetMicros, int expected) {
        User user = createUser();
        Instant boundary = Instant.parse("2035-01-01T00:00:00Z");
        String rawToken = "synthetic-boundary-token";
        createResetToken(user, rawToken, boundary.plus(offsetMicros, ChronoUnit.MICROS), false);

        Integer consumed = new TransactionTemplate(transactionManager).execute(status ->
                resetTokens.consumeUsableToken(hash(rawToken), user.getId(), boundary));

        assertThat(consumed).isEqualTo(expected);
        assertThat(resetTokens.count()).isEqualTo(1 - expected);
        if (expected == 1) {
            Integer reused = new TransactionTemplate(transactionManager).execute(status ->
                    resetTokens.consumeUsableToken(hash(rawToken), user.getId(), boundary));
            assertThat(reused).isZero();
        }
    }

    @Test
    void atomicConsumptionDoesNotMatchUsedTokensOrAnotherOwner() {
        User user = createUser();
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        createResetToken(user, "synthetic-used-cas", now.plusSeconds(60), true);
        createResetToken(user, "synthetic-other-owner-cas", now.plusSeconds(60), false);

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            assertThat(resetTokens.consumeUsableToken(hash("synthetic-used-cas"), user.getId(), now)).isZero();
            assertThat(resetTokens.consumeUsableToken(hash("synthetic-other-owner-cas"), UUID.randomUUID(), now)).isZero();
        });

        assertThat(resetTokens.count()).isEqualTo(2);
    }

    @Test
    void newerRecoveryRequestRevokesThePreviousTokenAndStoresOnlyAHash() {
        User user = createUser();
        String previousRaw = "synthetic-superseded-recovery-token";
        createResetToken(user, previousRaw, Instant.now().plusSeconds(600), false);

        authService.forgotPassword(new ForgotPasswordRequest(user.getEmail()));

        assertThat(resetTokens.findByTokenHash(hash(previousRaw))).isEmpty();
        assertThat(resetTokens.findAll()).singleElement().satisfies(token -> {
            assertThat(token.getUserId()).isEqualTo(user.getId());
            assertThat(token.getTokenHash()).matches("[a-f0-9]{64}");
            assertThat(token.getUsedAt()).isNull();
            assertThat(token.getExpiresAt()).isAfter(Instant.now());
        });
        assertThatThrownBy(() -> reset(previousRaw, RESET_PASSWORD)).isInstanceOf(BusinessException.class);
        assertPassword(user, INITIAL_PASSWORD);
    }

    @Test
    void authenticatedPasswordChangeRevokesRecoveryAndRefreshTokens() {
        User user = createUser();
        String rawToken = "synthetic-before-password-change";
        createResetToken(user, rawToken, Instant.now().plusSeconds(600), false);
        createRefreshToken(user, "synthetic-session-before-password-change");

        authService.changePassword(user.getId(), changeRequest());

        assertPassword(user, CHANGED_PASSWORD);
        assertThat(resetTokens.count()).isZero();
        assertThat(refreshTokens.count()).isZero();
        assertThatThrownBy(() -> reset(rawToken, RESET_PASSWORD)).isInstanceOf(BusinessException.class);
    }

    @Test
    void incorrectCurrentPasswordDoesNotConsumeRecoveryTokens() {
        User user = createUser();
        String rawToken = "synthetic-preserved-after-wrong-current-password";
        createResetToken(user, rawToken, Instant.now().plusSeconds(600), false);
        createRefreshToken(user, "synthetic-preserved-session");

        assertThatThrownBy(() -> authService.changePassword(user.getId(),
                new ChangePasswordRequest("synthetic-wrong-current", CHANGED_PASSWORD, CHANGED_PASSWORD)))
                .isInstanceOf(BusinessException.class);

        assertPassword(user, INITIAL_PASSWORD);
        assertThat(resetTokens.count()).isEqualTo(1);
        assertThat(refreshTokens.count()).isEqualTo(1);
        reset(rawToken, RESET_PASSWORD);
        assertPassword(user, RESET_PASSWORD);
    }

    @Test
    void internalCredentialReplacementRevokesRecoveryAndRefreshTokensWithoutReactivation() {
        User user = createUser();
        user.setEnabled(false);
        users.saveAndFlush(user);
        String rawToken = "synthetic-before-internal-replacement";
        createResetToken(user, rawToken, Instant.now().plusSeconds(600), false);
        createRefreshToken(user, "synthetic-session-before-internal-replacement");

        authService.setCredentials(new SetCredentialsRequest(user.getId(), PROVISIONED_PASSWORD));

        assertPassword(user, PROVISIONED_PASSWORD);
        assertThat(users.findById(user.getId()).orElseThrow().isEnabled()).isFalse();
        assertThat(resetTokens.count()).isZero();
        assertThat(refreshTokens.count()).isZero();
        assertThatThrownBy(() -> reset(rawToken, RESET_PASSWORD)).isInstanceOf(BusinessException.class);
    }

    @Test
    void disabledAccountCannotBeActivatedOrHaveItsPasswordReplacedThroughRecovery() {
        User user = createUser();
        user.setEnabled(false);
        users.saveAndFlush(user);
        String rawToken = "synthetic-disabled-account-recovery";
        createResetToken(user, rawToken, Instant.now().plusSeconds(600), false);
        createRefreshToken(user, "synthetic-disabled-session");

        assertThatThrownBy(() -> reset(rawToken, RESET_PASSWORD)).isInstanceOf(BusinessException.class);

        authService.forgotPassword(new ForgotPasswordRequest(user.getEmail()));
        assertPassword(user, INITIAL_PASSWORD);
        assertThat(users.findById(user.getId()).orElseThrow().isEnabled()).isFalse();
        assertThat(resetTokens.findByTokenHash(hash(rawToken))).isPresent();
        assertThat(refreshTokens.count()).isEqualTo(1);
    }

    @Test
    void deletedAccountCannotBeRecreatedByItsOldToken() {
        User user = createUser();
        String rawToken = "synthetic-deleted-account-recovery";
        createResetToken(user, rawToken, Instant.now().plusSeconds(600), false);
        // Delete dependents explicitly: H2's entity-generated schema has no migration-only FK cascade.
        resetTokens.deleteAll();
        users.deleteById(user.getId());

        assertThatThrownBy(() -> reset(rawToken, RESET_PASSWORD)).isInstanceOf(BusinessException.class);
        assertThat(users.findById(user.getId())).isEmpty();
        assertThat(users.count()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"ACCOUNT_NOT_FOUND", "ACCOUNT_DEACTIVATED", "ORGANIZATION_SUSPENDED", "SUBSCRIPTION_ENDED"})
    void tenantDenialCannotChangeCredentialsOrConsumeTokens(String reason) {
        User user = createUser();
        String rawToken = "synthetic-tenant-denied-recovery";
        createResetToken(user, rawToken, Instant.now().plusSeconds(600), false);
        createRefreshToken(user, "synthetic-tenant-denied-session");
        when(tenantAccessClient.check(user.getId())).thenReturn(new SignInAccess(false, null, reason));

        assertThatThrownBy(() -> reset(rawToken, RESET_PASSWORD))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Invalid, expired, or already used password reset token");

        assertPassword(user, INITIAL_PASSWORD);
        assertThat(users.findById(user.getId()).orElseThrow().isEnabled()).isTrue();
        assertThat(resetTokens.findByTokenHash(hash(rawToken))).isPresent();
        assertThat(refreshTokens.count()).isEqualTo(1);
    }

    @Test
    void tenantOutageRollsBackAndTheSameTokenCanBeRetriedAfterRecovery() {
        User user = createUser();
        String rawToken = "synthetic-retryable-recovery";
        createResetToken(user, rawToken, Instant.now().plusSeconds(600), false);
        createRefreshToken(user, "synthetic-retryable-session");
        when(tenantAccessClient.check(user.getId())).thenThrow(new TenantUnavailableException(new IllegalStateException()));

        assertThatThrownBy(() -> reset(rawToken, RESET_PASSWORD)).isInstanceOf(TenantUnavailableException.class);

        assertPassword(user, INITIAL_PASSWORD);
        assertThat(resetTokens.findByTokenHash(hash(rawToken))).isPresent();
        assertThat(refreshTokens.count()).isEqualTo(1);
        doReturn(new SignInAccess(true, "Full", null)).when(tenantAccessClient).check(user.getId());
        reset(rawToken, RESET_PASSWORD);
        assertPassword(user, RESET_PASSWORD);
    }

    @Test
    void failureAfterConsumptionAndPasswordWriteRollsBackAllPersistedChanges() {
        User user = createUser();
        String originalHash = users.findById(user.getId()).orElseThrow().getPasswordHash();
        String rawToken = "synthetic-recovery-before-persistence-failure";
        PasswordResetToken consumed = createResetToken(user, rawToken, Instant.now().plusSeconds(600), false);
        PasswordResetToken sibling = createResetToken(user, "synthetic-sibling-before-persistence-failure",
                Instant.now().plusSeconds(600), false);
        createRefreshToken(user, "synthetic-session-before-persistence-failure");
        // The real reset-token bulk delete flushes the pending password write before
        // session revocation. Fail only that final step to exercise transaction rollback.
        observations.failSessionDeletionFor = user.getId();
        try {
            assertThatThrownBy(() -> reset(rawToken, RESET_PASSWORD))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessage("Synthetic session persistence failure");
        } finally {
            observations.failSessionDeletionFor = null;
        }

        // Each lookup runs outside the failed transaction, so these are database values.
        assertThat(users.findById(user.getId()).orElseThrow().getPasswordHash()).isEqualTo(originalHash);
        assertThat(resetTokens.findAll()).extracting(PasswordResetToken::getId)
                .containsExactlyInAnyOrder(consumed.getId(), sibling.getId());
        assertThat(resetTokens.findById(consumed.getId()).orElseThrow().getUsedAt()).isNull();
        assertThat(refreshTokens.count()).isEqualTo(1);

        reset(rawToken, RESET_PASSWORD);
        assertPassword(user, RESET_PASSWORD);
        assertThat(resetTokens.count()).isZero();
        assertThat(refreshTokens.count()).isZero();
    }

    @Test
    void successfulResetDoesNotRevokeAnotherUsersCredentialsOrTokens() {
        User user = createUser();
        User other = createUser();
        createResetToken(user, "synthetic-owner-recovery", Instant.now().plusSeconds(600), false);
        createResetToken(other, "synthetic-other-recovery", Instant.now().plusSeconds(600), false);
        createRefreshToken(user, "synthetic-owner-session");
        createRefreshToken(other, "synthetic-other-session");

        reset("synthetic-owner-recovery", RESET_PASSWORD);

        assertPassword(other, INITIAL_PASSWORD);
        assertThat(resetTokens.findAll()).singleElement().extracting(PasswordResetToken::getUserId).isEqualTo(other.getId());
        assertThat(refreshTokens.findAll()).singleElement().extracting(RefreshToken::getUserId).isEqualTo(other.getId());
    }

    @Test
    void concurrentReuseOfTheSameTokenHasExactlyOneSuccessfulTransaction() throws Exception {
        User user = createUser();
        String rawToken = "synthetic-concurrently-reused-token";
        createResetToken(user, rawToken, Instant.now().plusSeconds(600), false);
        createRefreshToken(user, "synthetic-concurrently-revoked-session");

        List<Outcome> outcomes = runContending(user,
                () -> reset(rawToken, RESET_PASSWORD), () -> reset(rawToken, CHANGED_PASSWORD));

        assertThat(outcomes).filteredOn(Outcome::succeeded).hasSize(1);
        assertOnlyExpectedRejections(outcomes);
        assertPassword(user, outcomes.get(0).succeeded() ? RESET_PASSWORD : CHANGED_PASSWORD);
        assertThat(resetTokens.count()).isZero();
        assertThat(refreshTokens.count()).isZero();
    }

    @Test
    void concurrentSiblingTokensCannotBothReplaceThePassword() throws Exception {
        User user = createUser();
        createResetToken(user, "synthetic-concurrent-sibling-one", Instant.now().plusSeconds(600), false);
        createResetToken(user, "synthetic-concurrent-sibling-two", Instant.now().plusSeconds(600), false);

        List<Outcome> outcomes = runContending(user,
                () -> reset("synthetic-concurrent-sibling-one", RESET_PASSWORD),
                () -> reset("synthetic-concurrent-sibling-two", CHANGED_PASSWORD));

        assertThat(outcomes).filteredOn(Outcome::succeeded).hasSize(1);
        assertOnlyExpectedRejections(outcomes);
        assertPassword(user, outcomes.get(0).succeeded() ? RESET_PASSWORD : CHANGED_PASSWORD);
        assertThat(resetTokens.count()).isZero();
    }

    @Test
    void concurrentRecoveryIssuanceLeavesOnlyOneOutstandingToken() throws Exception {
        User user = createUser();
        createResetToken(user, "synthetic-before-concurrent-issuance", Instant.now().plusSeconds(600), false);

        List<Outcome> outcomes = runContending(user,
                () -> authService.forgotPassword(new ForgotPasswordRequest(user.getEmail())),
                () -> authService.forgotPassword(new ForgotPasswordRequest(user.getEmail())));

        assertThat(outcomes).allMatch(Outcome::succeeded);
        assertThat(resetTokens.findAll()).singleElement().satisfies(token -> {
            assertThat(token.getUserId()).isEqualTo(user.getId());
            assertThat(token.getTokenHash()).matches("[a-f0-9]{64}");
            assertThat(token.getTokenHash()).isNotEqualTo(hash("synthetic-before-concurrent-issuance"));
        });
        assertPassword(user, INITIAL_PASSWORD);
    }

    @Test
    void concurrentResetAndAuthenticatedChangeCannotUseStalePasswordState() throws Exception {
        User user = createUser();
        String rawToken = "synthetic-reset-racing-authenticated-change";
        createResetToken(user, rawToken, Instant.now().plusSeconds(600), false);

        List<Outcome> outcomes = runContending(user, () -> reset(rawToken, RESET_PASSWORD),
                () -> authService.changePassword(user.getId(), changeRequest()));

        assertThat(outcomes).filteredOn(Outcome::succeeded).hasSize(1);
        assertOnlyExpectedRejections(outcomes);
        assertPassword(user, outcomes.get(0).succeeded() ? RESET_PASSWORD : CHANGED_PASSWORD);
        assertThat(resetTokens.count()).isZero();
    }

    @Test
    void concurrentProvisioningAndResetCannotRestoreCredentialsAfterReplacement() throws Exception {
        User user = createUser();
        String rawToken = "synthetic-reset-racing-provisioning";
        createResetToken(user, rawToken, Instant.now().plusSeconds(600), false);

        List<Outcome> outcomes = runContending(user, () -> reset(rawToken, RESET_PASSWORD),
                () -> authService.setCredentials(new SetCredentialsRequest(user.getId(), PROVISIONED_PASSWORD)));

        assertThat(outcomes.get(1).succeeded()).isTrue();
        assertOnlyExpectedRejections(outcomes);
        assertPassword(user, PROVISIONED_PASSWORD);
        assertThat(resetTokens.count()).isZero();
        assertThatThrownBy(() -> reset(rawToken, CHANGED_PASSWORD)).isInstanceOf(BusinessException.class);
    }

    @Test
    void concurrentResetAndRefreshCannotLeaveAnActiveRefreshSession() throws Exception {
        User user = createUser();
        String rawToken = "synthetic-reset-racing-refresh";
        String rawRefresh = "synthetic-refresh-racing-reset";
        createResetToken(user, rawToken, Instant.now().plusSeconds(600), false);
        createRefreshToken(user, rawRefresh);

        List<Outcome> outcomes = runContending(user, () -> reset(rawToken, RESET_PASSWORD),
                () -> authService.refresh(new RefreshTokenRequest(rawRefresh)));

        assertThat(outcomes.get(0).succeeded()).isTrue();
        assertOnlyExpectedRejections(outcomes);
        assertPassword(user, RESET_PASSWORD);
        assertThat(refreshTokens.count()).isZero();
        assertThat(resetTokens.count()).isZero();
    }

    @Test
    void concurrentResetAndOldPasswordLoginCannotLeaveAnActiveRefreshSession() throws Exception {
        User user = createUser();
        String rawToken = "synthetic-reset-racing-login";
        createResetToken(user, rawToken, Instant.now().plusSeconds(600), false);

        List<Outcome> outcomes = runContending(user, () -> reset(rawToken, RESET_PASSWORD),
                () -> authService.login(new LoginRequest(user.getEmail(), INITIAL_PASSWORD)));

        assertThat(outcomes.get(0).succeeded()).isTrue();
        assertOnlyExpectedRejections(outcomes);
        assertPassword(user, RESET_PASSWORD);
        assertThat(refreshTokens.count()).isZero();
        assertThat(resetTokens.count()).isZero();
        assertThat(authService.login(new LoginRequest(user.getEmail(), RESET_PASSWORD)).getAccessToken()).isNotBlank();
    }

    private User createUser() {
        UUID id = UUID.randomUUID();
        User user = new User();
        user.setId(id);
        user.setUsername("recovery_" + id.toString().substring(0, 8));
        user.setEmail(id + "@identity-contract.invalid");
        user.setFullName("Synthetic Recovery Fixture");
        user.setPasswordHash(passwordEncoder.encode(INITIAL_PASSWORD));
        user.setRole(UserRole.LEARNER);
        user.setOrganizationId(UUID.randomUUID());
        user.setEnabled(true);
        return users.saveAndFlush(user);
    }

    private PasswordResetToken createResetToken(User user, String rawToken, Instant expiry, boolean used) {
        PasswordResetToken token = new PasswordResetToken();
        token.setId(UUID.randomUUID());
        token.setUserId(user.getId());
        token.setTokenHash(hash(rawToken));
        token.setExpiresAt(expiry);
        if (used) {
            token.setUsedAt(Instant.now().minusSeconds(1));
        }
        return resetTokens.saveAndFlush(token);
    }

    private void createRefreshToken(User user, String rawToken) {
        RefreshToken token = new RefreshToken();
        token.setId(UUID.randomUUID());
        token.setUserId(user.getId());
        token.setTokenHash(hash(rawToken));
        token.setExpiresAt(Instant.now().plusSeconds(600));
        refreshTokens.saveAndFlush(token);
    }

    private void reset(String rawToken, String password) {
        authService.resetPassword(new ResetPasswordRequest(rawToken, password, password));
    }

    private ChangePasswordRequest changeRequest() {
        return new ChangePasswordRequest(INITIAL_PASSWORD, CHANGED_PASSWORD, CHANGED_PASSWORD);
    }

    private void assertPassword(User user, String expected) {
        String storedHash = users.findById(user.getId()).orElseThrow().getPasswordHash();
        assertThat(passwordEncoder.matches(expected, storedHash)).isTrue();
    }

    private List<Outcome> runContending(User user, Runnable first, Runnable second) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2,
                task -> new Thread(task, WORKER_PREFIX + UUID.randomUUID()));
        List<Future<Outcome>> futures = new ArrayList<>();
        try {
            new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                // A separate transaction holds the real row lock until BOTH workers reach
                // their lock queries. No sleeps and no mocked query results are involved.
                entityManager.find(User.class, user.getId(), LockModeType.PESSIMISTIC_WRITE);
                observations.contendedUser = user.getId();
                observations.contendedEmail = user.getEmail();
                observations.lockAttempts = new CountDownLatch(2);
                futures.add(executor.submit(() -> attempt(first)));
                futures.add(executor.submit(() -> attempt(second)));
                try {
                    assertThat(observations.lockAttempts.await(10, TimeUnit.SECONDS))
                            .as("both independent service transactions attempt the held user-row lock")
                            .isTrue();
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("Interrupted while arranging database contention", interrupted);
                }
            });
            List<Outcome> outcomes = new ArrayList<>();
            for (Future<Outcome> future : futures) {
                outcomes.add(future.get(20, TimeUnit.SECONDS));
            }
            return outcomes;
        } finally {
            observations.clear();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    private Outcome attempt(Runnable action) {
        try {
            action.run();
            return new Outcome(true, null);
        } catch (RuntimeException failure) {
            return new Outcome(false, failure);
        }
    }

    private void assertOnlyExpectedRejections(List<Outcome> outcomes) {
        outcomes.stream().filter(outcome -> !outcome.succeeded()).forEach(outcome ->
                assertThat(outcome.failure()).as("concurrent rejection is not a deadlock or server failure")
                        .isInstanceOf(BusinessException.class));
    }

    private static String hash(String rawToken) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 unavailable", impossible);
        }
    }

    private record Outcome(boolean succeeded, RuntimeException failure) {
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class RepositoryObservationConfiguration {

        @Bean
        @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
        static RepositoryObservation repositoryObservation() {
            return new RepositoryObservation();
        }
    }

    /**
     * Wrap the real Spring Data proxy without replacing its query implementation.
     * invocation.proceed() retains Spring Data transactions and @Lock handling.
     */
    static final class RepositoryObservation implements BeanPostProcessor {

        private volatile CountDownLatch lockAttempts;
        private volatile UUID contendedUser;
        private volatile String contendedEmail;
        private volatile UUID failSessionDeletionFor;

        @Override
        public Object postProcessAfterInitialization(Object bean, String beanName) {
            boolean userRepository = bean instanceof UserRepository;
            boolean refreshRepository = bean instanceof RefreshTokenRepository;
            if (!userRepository && !refreshRepository) {
                return bean;
            }
            ProxyFactory proxy = new ProxyFactory(bean);
            proxy.addAdvice((MethodInterceptor) invocation -> {
                String method = invocation.getMethod().getName();
                Object[] arguments = invocation.getArguments();
                if (userRepository) {
                    if ("findByIdForUpdate".equals(method) || "findByEmailForUpdate".equals(method)) {
                        observeLockAttempt(arguments[0]);
                    } else if ("findByUsernameOrEmailForUpdate".equals(method)) {
                        observeLockAttempt(arguments[1]);
                    }
                }
                if (refreshRepository && "deleteByUserId".equals(method)
                        && arguments[0].equals(failSessionDeletionFor)) {
                    throw new IllegalStateException("Synthetic session persistence failure");
                }
                return invocation.proceed();
            });
            return proxy.getProxy();
        }

        private void observeLockAttempt(Object selector) {
            CountDownLatch attempts = lockAttempts;
            if (attempts != null && Thread.currentThread().getName().startsWith(WORKER_PREFIX)
                    && (selector.equals(contendedUser) || selector.equals(contendedEmail))) {
                attempts.countDown();
            }
        }

        private void clear() {
            lockAttempts = null;
            contendedUser = null;
            contendedEmail = null;
            failSessionDeletionFor = null;
        }
    }
}
