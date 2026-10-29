package com.learnup.identity.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.HeaderConstants;
import com.learnup.common.exception.BusinessException;
import com.learnup.common.security.UserRole;
import com.learnup.identity.client.NotificationEmailClient;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.config.PasswordRecoveryProperties;
import com.learnup.identity.domain.PasswordResetToken;
import com.learnup.identity.domain.RefreshToken;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.*;
import com.learnup.identity.dto.internal.SetCredentialsRequest;
import com.learnup.identity.dto.internal.SignInAccess;
import com.learnup.identity.exception.CredentialProvisioningConflictException;
import com.learnup.identity.exception.TenantUnavailableException;
import com.learnup.identity.repository.*;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.aopalliance.intercept.MethodInterceptor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.EnumSource;
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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** BR-39 email reuse (legacy BR-31): real HTTP security, DB transactions and forced races; mocked Tenant authority. */
@Import(Br39CredentialProvisioningContract.ObservationConfiguration.class)
abstract class Br39CredentialProvisioningContract {
    private static final String PATH = "/api/internal/credentials";
    private static final String KEY = "testInternalServiceKeyAtLeast32BytesLong!";
    private static final String PASSWORD = "SyntheticBr31OriginalPassword!31";
    private static final String REPLACEMENT = "SyntheticBr31ReplacementPassword!31";
    private static final String EMAIL = "shared@br31.invalid";
    private static final String WORKER = "br31-worker-";
    @Autowired AuthService auth;
    @Autowired JwtTokenService jwt;
    @Autowired UserRepository users;
    @Autowired RefreshTokenRepository sessions;
    @Autowired PasswordResetTokenRepository recovery;
    @Autowired LoginThrottleRepository throttles;
    @Autowired PasswordEncoder passwords;
    @Autowired RecoveryDeliveryState deliveryState;
    @Autowired PasswordRecoveryProperties recoveryProperties;
    @Autowired PlatformTransactionManager transactions;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired Observation observation;
    @MockBean TenantAccessClient tenant;

    @BeforeEach
    void isolatedState() {
        observation.clear();
        recovery.deleteAll();
        sessions.deleteAll();
        throttles.deleteAll();
        users.deleteAll();
        when(tenant.check(any())).thenReturn(new SignInAccess(true, "Full", null));
        // An unarranged cross-user lookup must fail closed, never Mockito's default boolean false.
        when(tenant.exists(any())).thenThrow(new TenantUnavailableException(null));
    }

    @Test
    void normalProvisioningRequiresAnEmailAndRetainsCanonicalMetadataAndSuccessContract() throws Exception {
        SetCredentialsRequest request = request(UUID.randomUUID(), "  New.Owner@br31.invalid  ");
        postCredentials(request).andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.message").value("Credentials successfully set"))
                .andExpect(jsonPath("$.data.accessToken").doesNotExist());
        User saved = users.findById(request.getUserId()).orElseThrow();
        assertThat(saved.getEmail()).isEqualTo("new.owner@br31.invalid");
        assertThat(saved.getUsername()).isEqualTo("user_" + request.getUserId().toString().replace("-", ""));
        assertThat(saved.getOrganizationId()).isEqualTo(request.getOrganizationId());
        assertThat(saved.getRole()).isEqualTo(UserRole.ORGANIZER);
        assertThat(saved.getFullName()).isEqualTo(request.getFullName());
        assertThat(passwords.matches(REPLACEMENT, saved.getPasswordHash())).isTrue();
        verifyNoInteractions(tenant);
    }

    @ParameterizedTest
    @EnumSource(value = UserRole.class, names = {"INSTRUCTOR", "LEARNER"})
    void invitationAcceptanceAndRetryUseTheSameCanonicalIdAndStillRequireTenantActivation(UserRole role) {
        User invitee = user("invited@br31.invalid");
        tokens(invitee);
        SetCredentialsRequest invitation = request(invitee.getId(), invitee.getEmail());
        invitation.setRole(role);
        auth.setCredentials(invitation);
        auth.setCredentials(invitation);
        when(tenant.check(invitee.getId())).thenReturn(new SignInAccess(false, null, "ACCOUNT_NOT_ACTIVE"));
        assertThatThrownBy(() -> auth.login(new LoginRequest(invitee.getEmail(), REPLACEMENT)))
                .isInstanceOf(com.learnup.identity.exception.SignInDeniedException.class);
        when(tenant.check(invitee.getId())).thenReturn(new SignInAccess(true, "Full", null));
        AuthResponse signedIn = auth.login(new LoginRequest(invitee.getEmail(), REPLACEMENT));
        assertThat(signedIn.getUser().getId()).isEqualTo(invitee.getId());
        assertThat(signedIn.getUser().getRole()).isEqualTo(role);
        assertThat(signedIn.getUser().getOrganizationId()).isEqualTo(invitation.getOrganizationId());
        assertThat(users.count()).isOne();
        assertThat(tokenRows("password_reset_tokens", invitee.getId())).isEmpty();
        verify(tenant, never()).exists(any());
    }

    @Test
    void provisioningLoginAndRecoveryUseTheSameLocaleIndependentEmailNormalization() {
        Locale original = Locale.getDefault();
        try {
            Locale.setDefault(Locale.forLanguageTag("tr-TR"));
            UUID id = UUID.randomUUID();
            auth.setCredentials(request(id, "  INPUT@br31.invalid  "));
            assertThat(auth.login(new LoginRequest("INPUT@br31.invalid", REPLACEMENT)).getUser().getId()).isEqualTo(id);
            auth.forgotPassword(new ForgotPasswordRequest("INPUT@br31.invalid"));
            assertThat(tokenRows("password_reset_tokens", id)).hasSize(1);
            assertThat(users.findById(id).orElseThrow().getEmail()).isEqualTo("input@br31.invalid");
        } finally {
            Locale.setDefault(original);
        }
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "not-an-email", "missing-domain@", "a@", "bad address@br31.invalid"})
    void invalidOrOmittedEmailCannotCreateCredentials(String email) throws Exception {
        User unrelated = user("unrelated@br31.invalid");
        tokens(unrelated);
        Snapshot before = snapshot();
        postCredentials(request(UUID.randomUUID(), email)).andExpect(status().isBadRequest());
        assertThat(snapshot().equals(before)).isTrue();
        verifyNoInteractions(tenant);
    }

    @Test
    void sameUserRetryAndPasswordOnlyReplacementPreserveIdentityAndRevokeOnlyRequesterTokens() {
        User target = user(EMAIL);
        User other = user("unrelated@br31.invalid");
        tokens(target);
        tokens(other);
        Map<String, Object> before = userRow(target.getId());
        var otherBefore = userRow(other.getId());
        var otherSessions = tokenRows("refresh_tokens", other.getId());
        var otherRecovery = tokenRows("password_reset_tokens", other.getId());
        auth.setCredentials(request(target.getId(), EMAIL));
        auth.setCredentials(new SetCredentialsRequest(target.getId(), REPLACEMENT));
        User after = users.findById(target.getId()).orElseThrow();
        assertThat(after.getEmail()).isEqualTo(EMAIL);
        assertThat(after.getUsername()).isEqualTo(before.get("username"));
        assertThat(userRow(target.getId()).get("created_at")).isEqualTo(before.get("created_at"));
        assertThat(passwords.matches(REPLACEMENT, after.getPasswordHash())).isTrue();
        assertThat(tokenRows("refresh_tokens", target.getId())).isEmpty();
        assertThat(tokenRows("password_reset_tokens", target.getId())).isEmpty();
        assertThat(otherBefore.equals(userRow(other.getId()))).isTrue();
        assertThat(tokenRows("refresh_tokens", other.getId())).isEqualTo(otherSessions);
        assertThat(tokenRows("password_reset_tokens", other.getId())).isEqualTo(otherRecovery);
        verifyNoInteractions(tenant);
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void nondeletedOwnerIsRejectedEvenWhenIdentityOrTenantDisallowsSignIn(boolean enabled) throws Exception {
        User owner = user(EMAIL);
        owner.setEnabled(enabled);
        users.saveAndFlush(owner);
        tokens(owner);
        User requester = user("requester@br31.invalid");
        tokens(requester);
        Snapshot before = snapshot();
        doReturn(true).when(tenant).exists(owner.getId());
        when(tenant.check(owner.getId())).thenReturn(new SignInAccess(false, null, "ORGANIZATION_SUSPENDED"));

        postCredentials(request(requester.getId(), "SHARED@br31.invalid"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("EMAIL_IN_USE"));

        assertThat(snapshot().equals(before)).isTrue();
        verify(tenant).exists(owner.getId());
        verify(tenant, never()).check(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"soft-deleted", "never-committed-orphan"})
    void falseReleasesOnlyTheEmailWhilePreservingBothCanonicalUsersAndStoredRecords(String tenantState) throws Exception {
        User owner = user(EMAIL);
        owner.setEnabled(false);
        users.saveAndFlush(owner);
        User unrelated = user("unrelated@br31.invalid");
        tokens(owner);
        tokens(unrelated);
        var ownerBefore = userRow(owner.getId());
        var unrelatedBefore = userRow(unrelated.getId());
        var sessionsBefore = jdbc.queryForList("SELECT * FROM refresh_tokens ORDER BY id");
        var recoveryBefore = jdbc.queryForList("SELECT * FROM password_reset_tokens ORDER BY id");
        UUID requester = UUID.randomUUID();
        doReturn(false).when(tenant).exists(owner.getId());

        postCredentials(request(requester, EMAIL)).andExpect(status().isOk());

        assertReleasedOwner(ownerBefore, owner.getId());
        assertThat(unrelatedBefore.equals(userRow(unrelated.getId()))).isTrue();
        assertThat(jdbc.queryForList("SELECT * FROM refresh_tokens ORDER BY id")).isEqualTo(sessionsBefore);
        assertThat(jdbc.queryForList("SELECT * FROM password_reset_tokens ORDER BY id")).isEqualTo(recoveryBefore);
        assertThat(users.findByEmail(EMAIL).orElseThrow().getId()).isEqualTo(requester);
        assertThat(users.count()).as(tenantState).isEqualTo(3);
        var releasedBeforeRetry = userRow(owner.getId());
        auth.setCredentials(request(requester, EMAIL));
        assertThat(releasedBeforeRetry.equals(userRow(owner.getId()))).isTrue();
        assertThat(jdbc.queryForList("SELECT * FROM refresh_tokens ORDER BY id")).isEqualTo(sessionsBefore);
        assertThat(jdbc.queryForList("SELECT * FROM password_reset_tokens ORDER BY id")).isEqualTo(recoveryBefore);
        verify(tenant).exists(owner.getId());
        verify(tenant, never()).check(any());
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void realEnvelopedExistenceControlsConflictOrPreservingHandoff(boolean exists) throws Exception {
        User owner = user(EMAIL);
        User unrelated = user("unrelated@br31.invalid");
        tokens(owner);
        tokens(unrelated);
        Snapshot before = snapshot();
        var ownerBefore = userRow(owner.getId());
        var unrelatedBefore = userRow(unrelated.getId());
        UUID requester = UUID.randomUUID();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/v1/internal/users/" + owner.getId() + "/existence", exchange -> {
            assertThat(exchange.getRequestHeaders().getFirst(HeaderConstants.X_INTERNAL_KEY)).isEqualTo(KEY);
            respond(exchange, 200, existenceEnvelope(Boolean.toString(exists)));
        });
        server.start();
        TenantAccessClient realClient = new TenantAccessClient("http://127.0.0.1:" + server.getAddress().getPort(), KEY);
        doAnswer(call -> realClient.exists(call.getArgument(0))).when(tenant).exists(owner.getId());
        try {
            ResultActions response = postCredentials(request(requester, EMAIL));
            if (exists) {
                response.andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("EMAIL_IN_USE"));
                assertThat(snapshot().equals(before)).isTrue();
            } else {
                response.andExpect(status().isOk());
                assertReleasedOwner(ownerBefore, owner.getId());
                assertThat(unrelatedBefore.equals(userRow(unrelated.getId()))).isTrue();
                assertThat(snapshot().sessions()).isEqualTo(before.sessions());
                assertThat(snapshot().recovery()).isEqualTo(before.recovery());
                assertThat(users.findByEmail(EMAIL).orElseThrow().getId()).isEqualTo(requester);
                assertThat(users.count()).isEqualTo(3);
            }
            verify(tenant).exists(owner.getId());
            verify(tenant, never()).check(any());
        } finally {
            server.stop(0);
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"201", "401", "403", "404", "500", "503", "invalid", "coerced", "missing",
            "raw", "null-data", "missing-data", "extra-data", "bad-envelope", "non-json", "oversized", "redirect",
            "timeout", "disconnect"})
    void realExistenceHttpFailuresReturn503AndLeaveEveryAccountAndTokenUnchanged(String failure) throws Exception {
        User owner = user(EMAIL);
        User requester = user("requester@br31.invalid");
        tokens(owner);
        tokens(requester);
        Snapshot before = snapshot();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        ExecutorService executor = Executors.newCachedThreadPool();
        server.setExecutor(executor);
        server.createContext("/api/v1/internal/users/" + owner.getId() + "/existence", exchange -> {
            assertThat(exchange.getRequestHeaders().getFirst(HeaderConstants.X_INTERNAL_KEY)).isEqualTo(KEY);
            if ("disconnect".equals(failure)) {
                exchange.close();
                return;
            }
            if ("timeout".equals(failure)) {
                try {
                    Thread.sleep(5000);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    exchange.close();
                    return;
                }
            }
            int status = "redirect".equals(failure) ? 302
                    : failure.matches("[0-9]+") ? Integer.parseInt(failure) : 200;
            String body = switch (failure) {
                case "coerced" -> existenceEnvelope("\"false\"");
                case "missing" -> existenceEnvelope("false").replace("{\"exists\":false}", "{}");
                case "raw" -> "{\"exists\":false}";
                case "null-data" -> existenceEnvelope("false").replace("{\"exists\":false}", "null");
                case "missing-data" -> "{\"statusCode\":200,\"message\":\"User existence checked\"}";
                case "extra-data" -> existenceEnvelope("false").replace("false}", "false,\"allowed\":false}");
                case "bad-envelope" -> "{\"data\":{\"exists\":false}}";
                case "oversized" -> existenceEnvelope("false") + " ".repeat(1024);
                case "201", "non-json", "redirect" -> existenceEnvelope("false");
                default -> "synthetic-br31-private-tenant-response";
            };
            if ("non-json".equals(failure)) exchange.getResponseHeaders().set("Content-Type", "text/plain");
            if ("redirect".equals(failure)) exchange.getResponseHeaders().set("Location", "/redirect-target");
            respond(exchange, status, body);
        });
        server.start();
        TenantAccessClient realClient = new TenantAccessClient("http://127.0.0.1:" + server.getAddress().getPort(), KEY);
        doAnswer(call -> realClient.exists(call.getArgument(0))).when(tenant).exists(owner.getId());
        try {
            String body = postCredentials(request(requester.getId(), EMAIL)).andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.error.code").value("TENANT_UNAVAILABLE"))
                    .andReturn().getResponse().getContentAsString();
            assertThat(body).doesNotContain(KEY, PASSWORD, REPLACEMENT, owner.getPasswordHash(),
                    "synthetic-br31-private-tenant-response");
            assertThat(snapshot().equals(before)).isTrue();
        } finally {
            server.stop(0);
            executor.shutdownNow();
            assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test
    void failedUniqueConstraintRestoresTheAlreadyFlushedReleaseAndExistingRequesterCredentials() throws Exception {
        User owner = user(EMAIL);
        User requester = user("requester@br31.invalid");
        User other = user("other@br31.invalid");
        tokens(owner);
        tokens(requester);
        tokens(other);
        Snapshot before = snapshot();
        doReturn(false).when(tenant).exists(owner.getId());
        SetCredentialsRequest request = request(requester.getId(), EMAIL);
        request.setUsername(other.getUsername());

        postCredentials(request).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CREDENTIAL_CONFLICT"));

        assertThat(observation.releasedFlushes).contains(owner.getId());
        assertThat(snapshot().equals(before)).isTrue();
    }

    @Test
    void failureAfterRequesterTokenCleanupRollsBackBothOwnersAndAllTokenRows() {
        User owner = user(EMAIL);
        User requester = user("requester@br31.invalid");
        tokens(owner);
        tokens(requester);
        Snapshot before = snapshot();
        doReturn(false).when(tenant).exists(owner.getId());
        observation.failSessionDeletionFor = requester.getId();

        assertThatThrownBy(() -> auth.setCredentials(request(requester.getId(), EMAIL)))
                .isInstanceOf(IllegalStateException.class).hasMessage("Synthetic post-cleanup failure");

        assertThat(observation.releasedFlushes).contains(owner.getId());
        assertThat(snapshot().equals(before)).isTrue();
    }

    @Test
    void simultaneousNewClaimsAreArbitratedByTheRealUniqueConstraintWithoutTenantHandoff() throws Exception {
        User unrelated = user("other@br31.invalid");
        tokens(unrelated);
        var unrelatedBefore = userRow(unrelated.getId());
        var sessionsBefore = tokenRows("refresh_tokens", unrelated.getId());
        var recoveryBefore = tokenRows("password_reset_tokens", unrelated.getId());
        SetCredentialsRequest first = request(UUID.randomUUID(), EMAIL);
        SetCredentialsRequest second = request(UUID.randomUUID(), EMAIL);
        observation.contendedEmail = EMAIL;
        observation.completedPreflights = new CountDownLatch(2);
        ExecutorService workers = workers();
        try {
            Future<Outcome> one = workers.submit(() -> attempt(first));
            Future<Outcome> two = workers.submit(() -> attempt(second));
            List<Outcome> outcomes = List.of(one.get(20, TimeUnit.SECONDS), two.get(20, TimeUnit.SECONDS));
            assertSingleWinner(outcomes);
            assertThat(observation.constraintFailures.get()).isOne();
            assertThat(observation.completedPreflights.getCount()).isZero();
            assertThat(users.count()).isEqualTo(2);
            assertThat(users.findEmailOwnerIds(EMAIL)).hasSize(1);
            assertThat(unrelatedBefore.equals(userRow(unrelated.getId()))).isTrue();
            assertThat(tokenRows("refresh_tokens", unrelated.getId())).isEqualTo(sessionsBefore);
            assertThat(tokenRows("password_reset_tokens", unrelated.getId())).isEqualTo(recoveryBefore);
            verifyNoInteractions(tenant);
        } finally {
            stop(workers);
        }
    }

    @Test
    void concurrentHandoffsCannotReinterpretTheFirstWinnerAsAnOrphan() throws Exception {
        User owner = user(EMAIL);
        tokens(owner);
        var before = userRow(owner.getId());
        var sessionsBefore = tokenRows("refresh_tokens", owner.getId());
        var recoveryBefore = tokenRows("password_reset_tokens", owner.getId());
        CountDownLatch checkingTenant = new CountDownLatch(1);
        CountDownLatch allowReply = new CountDownLatch(1);
        doAnswer(call -> {
            checkingTenant.countDown();
            if (!allowReply.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Tenant gate timed out");
            return false;
        }).when(tenant).exists(owner.getId());
        SetCredentialsRequest first = request(UUID.randomUUID(), EMAIL);
        SetCredentialsRequest second = request(UUID.randomUUID(), EMAIL);
        ExecutorService workers = workers();
        try {
            Future<Outcome> one = workers.submit(() -> attempt(first));
            assertThat(checkingTenant.await(10, TimeUnit.SECONDS)).isTrue();
            // The first transaction holds a real owner-row lock while its HTTP authority check is pending.
            Future<Outcome> two = workers.submit(() -> attempt(second));
            Outcome loser = two.get(5, TimeUnit.SECONDS);
            assertThat(loser.failure()).isInstanceOf(CredentialProvisioningConflictException.class);
            allowReply.countDown();
            assertThat(one.get(10, TimeUnit.SECONDS).success()).isTrue();
            assertThat(users.findById(second.getUserId())).isEmpty();
            assertThat(users.findByEmail(EMAIL).orElseThrow().getId()).isEqualTo(first.getUserId());
            assertReleasedOwner(before, owner.getId());
            assertThat(tokenRows("refresh_tokens", owner.getId())).isEqualTo(sessionsBefore);
            assertThat(tokenRows("password_reset_tokens", owner.getId())).isEqualTo(recoveryBefore);
            verify(tenant, times(1)).exists(owner.getId());
        } finally {
            allowReply.countDown();
            stop(workers);
        }
    }

    @Test
    void anOwnerChangedAfterTheSnapshotIsRejectedWithoutConsultingOrMutatingTheNewOwner() {
        User owner = user(EMAIL);
        User concurrentWinner = user("winner@br31.invalid");
        UUID requester = UUID.randomUUID();
        observation.beforeOwnerLock = () -> {
            TransactionTemplate concurrent = new TransactionTemplate(transactions);
            concurrent.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            concurrent.executeWithoutResult(status -> {
                User old = users.findByIdForUpdate(owner.getId()).orElseThrow();
                old.setEmail(null);
                users.saveAndFlush(old);
                User winner = users.findByIdForUpdate(concurrentWinner.getId()).orElseThrow();
                winner.setEmail(EMAIL);
                users.saveAndFlush(winner);
            });
        };
        assertThatThrownBy(() -> auth.setCredentials(request(requester, EMAIL)))
                .isInstanceOf(CredentialProvisioningConflictException.class);
        assertThat(users.findByEmail(EMAIL).orElseThrow().getId()).isEqualTo(concurrentWinner.getId());
        assertThat(users.findById(requester)).isEmpty();
        assertThat(passwords.matches(PASSWORD, users.findById(concurrentWinner.getId()).orElseThrow().getPasswordHash())).isTrue();
        verifyNoInteractions(tenant);
    }

    @Test
    void aRequesterCreatedAfterTheReadCannotBeOverwrittenByAssignedIdMerge() {
        User owner = user(EMAIL);
        tokens(owner);
        UUID requester = UUID.randomUUID();
        doReturn(false).when(tenant).exists(owner.getId());
        AtomicReference<Snapshot> committedConcurrentState = new AtomicReference<>();
        observation.beforeInsert = () -> {
            TransactionTemplate concurrent = new TransactionTemplate(transactions);
            concurrent.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            concurrent.executeWithoutResult(status -> {
                User legitimate = newUser(requester, "legitimate@br31.invalid");
                legitimate.setEnabled(false);
                users.saveAndFlush(legitimate);
                tokens(legitimate);
                committedConcurrentState.set(snapshot());
            });
        };

        assertThatThrownBy(() -> auth.setCredentials(request(requester, EMAIL)))
                .isInstanceOf(CredentialProvisioningConflictException.class);

        assertThat(observation.releasedFlushes).contains(owner.getId());
        assertThat(snapshot().equals(committedConcurrentState.get())).isTrue();
        assertThat(users.findById(requester).orElseThrow().isEnabled()).isFalse();
        assertThat(users.findByEmail(EMAIL).orElseThrow().getId()).isEqualTo(owner.getId());
    }

    @ParameterizedTest
    @ValueSource(strings = {"ACCOUNT_NOT_FOUND", "ACCOUNT_DEACTIVATED", "allowed"})
    void releasedCredentialsCannotAuthenticateRefreshOrResetEvenIfTenantLaterAllowsTheId(String reason) throws Exception {
        User owner = user(EMAIL);
        tokens(owner);
        UUID requester = UUID.randomUUID();
        doReturn(false).when(tenant).exists(owner.getId());
        auth.setCredentials(request(requester, EMAIL));
        Snapshot before = snapshot();
        when(tenant.check(owner.getId())).thenReturn(new SignInAccess("allowed".equals(reason), "Full", reason));

        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new LoginRequest(owner.getUsername(), PASSWORD))))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new LoginRequest(EMAIL, PASSWORD))))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new RefreshTokenRequest(refreshRaw(owner)))))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new RefreshTokenRequest(refreshRaw(owner) + "-used"))))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new ResetPasswordRequest(recoveryRaw(owner), REPLACEMENT, REPLACEMENT))))
                .andExpect(status().isBadRequest());
        assertThatThrownBy(() -> auth.getCurrentUser(owner.getId())).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> auth.changePassword(owner.getId(), new ChangePasswordRequest(PASSWORD, REPLACEMENT, REPLACEMENT)))
                .isInstanceOf(BusinessException.class);
        assertThat(snapshot().equals(before)).isTrue();
        verify(tenant, times(3)).check(owner.getId());
    }

    @Test
    void retainedEmailShapedUsernameCannotShadowTheNewOwnersEmailLogin() {
        User owner = user(EMAIL);
        owner.setUsername(EMAIL);
        users.saveAndFlush(owner);
        UUID requester = UUID.randomUUID();
        doReturn(false).when(tenant).exists(owner.getId());
        auth.setCredentials(request(requester, EMAIL));

        AuthResponse response = auth.login(new LoginRequest(EMAIL, REPLACEMENT));
        assertThat(response.getUser().getId()).isEqualTo(requester);
        assertThat(users.findById(owner.getId()).orElseThrow().getUsername()).isEqualTo(EMAIL);
        verify(tenant).check(requester);
        verify(tenant, never()).check(owner.getId());
    }

    @Test
    void alreadyIssuedJwtCannotReadANullEmailProfileOrReplaceReleasedCredentials() throws Exception {
        User owner = user(EMAIL);
        tokens(owner);
        String accessToken = jwt.generateAccessToken(owner);
        doReturn(false).when(tenant).exists(owner.getId());
        auth.setCredentials(request(UUID.randomUUID(), EMAIL));
        Snapshot before = snapshot();
        mvc.perform(get("/api/v1/auth/me").header(HeaderConstants.X_INTERNAL_KEY, KEY)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.data").doesNotExist());
        mvc.perform(post("/api/v1/auth/change-password").header(HeaderConstants.X_INTERNAL_KEY, KEY)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new ChangePasswordRequest(PASSWORD, REPLACEMENT, REPLACEMENT))))
                .andExpect(status().isUnauthorized());
        assertThat(snapshot().equals(before)).isTrue();
    }

    @Test
    void obsoleteRecoveryDeliveryAfterHandoffNeitherSendsNorDeletesTheOldToken() {
        User owner = user(EMAIL);
        tokens(owner);
        PasswordResetToken oldToken = recovery.findByTokenHash(hash(recoveryRaw(owner))).orElseThrow();
        doReturn(false).when(tenant).exists(owner.getId());
        auth.setCredentials(request(UUID.randomUUID(), EMAIL));
        Snapshot before = snapshot();
        NotificationEmailClient notification = mock(NotificationEmailClient.class);
        PasswordRecoveryDelivery delivery = new PasswordRecoveryDelivery(Runnable::run, deliveryState, tenant,
                notification, recoveryProperties, true);
        clearInvocations(tenant);

        new TransactionTemplate(transactions).executeWithoutResult(status -> delivery.scheduleAfterCommit(owner.getId(),
                EMAIL, oldToken.getId(), recoveryRaw(owner), oldToken.getExpiresAt(), UUID.randomUUID().toString()));

        assertThat(deliveryState.isDeliverable(owner.getId(), oldToken.getId(), EMAIL)).isFalse();
        assertThat(deliveryState.isDeliverable(owner.getId(), oldToken.getId(), null)).isFalse();
        assertThat(snapshot().equals(before)).isTrue();
        verifyNoInteractions(notification, tenant);
    }

    @Test
    void recoveryForReusedEmailTargetsOnlyItsNewCanonicalOwner() {
        User owner = user(EMAIL);
        tokens(owner);
        var oldRecovery = tokenRows("password_reset_tokens", owner.getId());
        UUID requester = UUID.randomUUID();
        doReturn(false).when(tenant).exists(owner.getId());
        auth.setCredentials(request(requester, EMAIL));
        auth.forgotPassword(new ForgotPasswordRequest(EMAIL));
        assertThat(tokenRows("password_reset_tokens", owner.getId())).isEqualTo(oldRecovery);
        assertThat(tokenRows("password_reset_tokens", requester)).hasSize(1);
    }

    @Test
    void multipleReleasedOwnersHaveNullEmailsWhileEveryNonNullClaimRemainsUnique() {
        User one = user(EMAIL);
        doReturn(false).when(tenant).exists(one.getId());
        UUID second = UUID.randomUUID();
        auth.setCredentials(request(second, EMAIL));
        doReturn(false).when(tenant).exists(second);
        UUID third = UUID.randomUUID();
        auth.setCredentials(request(third, EMAIL));
        assertThat(users.findAll()).filteredOn(user -> user.getEmail() == null).hasSize(2);
        assertThat(users.findEmailOwnerIds(EMAIL)).containsExactly(third);
        assertThatThrownBy(() -> users.saveAndFlush(newUser(UUID.randomUUID(), EMAIL)))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(users.count()).isEqualTo(3);
        assertThatThrownBy(() -> auth.setCredentials(new SetCredentialsRequest(one.getId(), REPLACEMENT)))
                .isInstanceOf(BusinessException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "synthetic-invalid-internal-key"})
    void invalidInternalAuthenticationCannotTriggerAnExistenceLookupOrAnyWrite(String key) throws Exception {
        User owner = user(EMAIL);
        tokens(owner);
        Snapshot before = snapshot();
        mvc.perform(post(PATH).header(HeaderConstants.X_INTERNAL_KEY, key)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer synthetic-untrusted-token")
                        .header("X-User-ID", owner.getId().toString()).header("X-User-Role", "ADMIN")
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request(UUID.randomUUID(), EMAIL))))
                .andExpect(status().isForbidden());
        assertThat(snapshot().equals(before)).isTrue();
        verifyNoInteractions(tenant);
    }

    private SetCredentialsRequest request(UUID id, String email) {
        return new SetCredentialsRequest(id, REPLACEMENT, null, email,
                "Canonical Tenant Account", UserRole.ORGANIZER, UUID.fromString("01990000-0000-7000-8000-000000000100"));
    }

    private User newUser(UUID id, String email) {
        Instant now = Instant.now();
        return new User(id, "user_" + id, email, passwords.encode(PASSWORD), "Retained Owner",
                UserRole.LEARNER, UUID.randomUUID(), true, now, now);
    }

    private User user(String email) {
        return users.saveAndFlush(newUser(UUID.randomUUID(), email));
    }

    private void tokens(User owner) {
        Instant now = Instant.now();
        UUID family = UUID.randomUUID();
        for (boolean used : List.of(false, true)) {
            String suffix = used ? "-used" : "";
            Instant revoked = used ? now.minusSeconds(1) : null;
            RefreshToken session = new RefreshToken(UUID.randomUUID(), owner.getId(), hash(refreshRaw(owner) + suffix),
                    now.plusSeconds(3600), revoked, now);
            session.setFamilyId(family);
            if (used) session.setReplacedBy(family);
            sessions.saveAndFlush(session);
            recovery.saveAndFlush(new PasswordResetToken(UUID.randomUUID(), owner.getId(), hash(recoveryRaw(owner) + suffix),
                    now.plusSeconds(600), revoked, now));
        }
    }

    private String refreshRaw(User owner) { return "synthetic-br31-refresh-" + owner.getId(); }
    private String recoveryRaw(User owner) { return "synthetic-br31-recovery-" + owner.getId(); }

    private ResultActions postCredentials(SetCredentialsRequest request) throws Exception {
        return mvc.perform(post(PATH).header(HeaderConstants.X_INTERNAL_KEY, KEY).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(request)));
    }

    private Map<String, Object> userRow(UUID id) {
        Map<String, Object> result = new HashMap<>();
        jdbc.queryForMap("SELECT * FROM users WHERE id = ?", id)
                .forEach((key, value) -> result.put(key.toLowerCase(Locale.ROOT), value));
        return result;
    }

    private void assertReleasedOwner(Map<String, Object> before, UUID id) {
        Map<String, Object> expected = new HashMap<>(before);
        expected.put("email", null);
        Map<String, Object> after = userRow(id);
        assertThat(after.get("updated_at")).isNotNull();
        expected.remove("updated_at");
        after.remove("updated_at");
        assertThat(after.equals(expected)).as("only the email claim and audit timestamp may change").isTrue();
    }

    private List<Map<String, Object>> tokenRows(String table, UUID owner) {
        if (!Set.of("refresh_tokens", "password_reset_tokens").contains(table)) throw new AssertionError("Unknown test table");
        return jdbc.queryForList("SELECT * FROM " + table + " WHERE user_id = ? ORDER BY id", owner);
    }

    private Snapshot snapshot() {
        return new Snapshot(jdbc.queryForList("SELECT * FROM users ORDER BY id"),
                jdbc.queryForList("SELECT * FROM refresh_tokens ORDER BY id"),
                jdbc.queryForList("SELECT * FROM password_reset_tokens ORDER BY id"));
    }

    private record Snapshot(List<Map<String, Object>> users, List<Map<String, Object>> sessions,
                            List<Map<String, Object>> recovery) { }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new AssertionError(impossible);
        }
    }

    private ExecutorService workers() {
        return Executors.newFixedThreadPool(2, task -> new Thread(task, WORKER + UUID.randomUUID()));
    }

    private Outcome attempt(SetCredentialsRequest request) {
        try {
            auth.setCredentials(request);
            return new Outcome(true, null);
        } catch (RuntimeException failure) {
            return new Outcome(false, failure);
        }
    }

    private void assertSingleWinner(List<Outcome> outcomes) {
        assertThat(outcomes).filteredOn(Outcome::success).hasSize(1);
        outcomes.stream().filter(outcome -> !outcome.success()).forEach(outcome ->
                assertThat(outcome.failure()).isInstanceOf(CredentialProvisioningConflictException.class));
    }

    private record Outcome(boolean success, RuntimeException failure) { }

    private void stop(ExecutorService workers) throws InterruptedException {
        workers.shutdownNow();
        assertThat(workers.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        if (!exchange.getResponseHeaders().containsKey("Content-Type")) {
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        }
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private static String existenceEnvelope(String exists) {
        return "{\"statusCode\":200,\"message\":\"User existence checked\",\"data\":{\"exists\":" + exists + "}}";
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class ObservationConfiguration {
        @Bean
        @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
        static Observation emailReuseObservation() { return new Observation(); }
    }

    /** Gates real queries/flushes. No repository results or database lock behavior are mocked. */
    static final class Observation implements BeanPostProcessor {
        private volatile String contendedEmail;
        private volatile CountDownLatch completedPreflights;
        private volatile UUID failSessionDeletionFor;
        private volatile Runnable beforeOwnerLock;
        private volatile Runnable beforeInsert;
        private final Map<Long, Integer> reads = new ConcurrentHashMap<>();
        private final Set<UUID> releasedFlushes = ConcurrentHashMap.newKeySet();
        private final AtomicInteger constraintFailures = new AtomicInteger();

        void clear() {
            contendedEmail = null;
            completedPreflights = null;
            failSessionDeletionFor = null;
            beforeOwnerLock = null;
            beforeInsert = null;
            reads.clear();
            releasedFlushes.clear();
            constraintFailures.set(0);
        }

        @Override
        public Object postProcessAfterInitialization(Object bean, String name) {
            if (!(bean instanceof UserRepository) && !(bean instanceof RefreshTokenRepository)) return bean;
            ProxyFactory proxy = new ProxyFactory(bean);
            proxy.addAdvice((MethodInterceptor) invocation -> {
                String method = invocation.getMethod().getName();
                if ("findCredentialOwnersForUpdate".equals(method) && beforeOwnerLock != null) {
                    Runnable hook = beforeOwnerLock;
                    beforeOwnerLock = null;
                    hook.run();
                }
                if ("insertAndFlush".equals(method) && beforeInsert != null) {
                    Runnable hook = beforeInsert;
                    beforeInsert = null;
                    hook.run();
                }
                Object result;
                try {
                    result = invocation.proceed();
                } catch (DataIntegrityViolationException failure) {
                    if (Thread.currentThread().getName().startsWith(WORKER)) constraintFailures.incrementAndGet();
                    throw failure;
                }
                if ("saveAndFlush".equals(method) && invocation.getArguments()[0] instanceof User user && user.getEmail() == null) {
                    releasedFlushes.add(user.getId());
                }
                if ("findEmailOwnerIds".equals(method) && contendedEmail != null
                        && contendedEmail.equals(invocation.getArguments()[0]) && Thread.currentThread().getName().startsWith(WORKER)) {
                    int count = reads.merge(Thread.currentThread().threadId(), 1, Integer::sum);
                    if (count == 2 && completedPreflights != null) {
                        completedPreflights.countDown();
                        if (!completedPreflights.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Both real preflights must finish");
                    }
                }
                if (bean instanceof RefreshTokenRepository refresh && "deleteByUserId".equals(method)
                        && invocation.getArguments()[0].equals(failSessionDeletionFor)) {
                    refresh.flush();
                    throw new IllegalStateException("Synthetic post-cleanup failure");
                }
                return result;
            });
            return proxy.getProxy();
        }
    }
}
