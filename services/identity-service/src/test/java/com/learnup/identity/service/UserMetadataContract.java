package com.learnup.identity.service;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.HeaderConstants;
import com.learnup.common.exception.BusinessException;
import com.learnup.common.exception.ErrorCode;
import com.learnup.common.security.UserRole;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.domain.PasswordResetToken;
import com.learnup.identity.domain.RefreshToken;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.LoginRequest;
import com.learnup.identity.dto.RefreshTokenRequest;
import com.learnup.identity.dto.internal.SignInAccess;
import com.learnup.identity.dto.internal.UpdateUserMetadataRequest;
import com.learnup.identity.repository.LoginThrottleRepository;
import com.learnup.identity.repository.PasswordResetTokenRepository;
import com.learnup.identity.repository.RefreshTokenRepository;
import com.learnup.identity.repository.UserRepository;
import org.aopalliance.intercept.MethodInterceptor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
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

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Real filters, repositories and independently committed transactions; only remote Tenant is mocked. */
@Import(UserMetadataContract.ObservationConfiguration.class)
abstract class UserMetadataContract {
    private static final String PATH = "/api/internal/credentials/metadata";
    private static final String KEY = "testInternalServiceKeyAtLeast32BytesLong!";
    private static final String PASSWORD = "SyntheticMetadataPassword!73";
    private static final String WORKER_PREFIX = "identity-metadata-claim-";
    private static final UUID ORGANIZATION = UUID.fromString("01990000-0000-7000-8000-000000000210");

    @Autowired private UserMetadataService metadata;
    @Autowired private AuthService auth;
    @Autowired private JwtTokenService jwt;
    @Autowired private UserRepository users;
    @Autowired private RefreshTokenRepository refresh;
    @Autowired private PasswordResetTokenRepository recovery;
    @Autowired private LoginThrottleRepository throttles;
    @Autowired private PasswordEncoder encoder;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private RepositoryObservation observation;
    @MockBean private TenantAccessClient tenant;

    @BeforeEach
    void isolatedFixtures() {
        observation.clear();
        recovery.deleteAll();
        refresh.deleteAll();
        throttles.deleteAll();
        users.deleteAll();
        when(tenant.check(any())).thenReturn(new SignInAccess(true, "Full", null));
    }

    @Test
    void correctsOnlyPermittedMetadataAndPreservesCredentialsAndTokens() throws Exception {
        User target = user();
        User other = user();
        tokens(target);
        tokens(other);
        Map<String, Object> before = userRow(target.getId());
        Map<String, Object> otherBefore = userRow(other.getId());
        var sessionsBefore = sessionRows();
        var recoveryBefore = recoveryRows();

        mvc.perform(put(PATH).header(HeaderConstants.X_INTERNAL_KEY, KEY)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request(target))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").doesNotExist())
                .andExpect(jsonPath("$.data.refreshToken").doesNotExist());

        User after = users.findById(target.getId()).orElseThrow();
        assertThat(after.getEmail()).isEqualTo("canonical@metadata.invalid");
        assertThat(after.getRole()).isEqualTo(UserRole.ORGANIZER);
        assertThat(after.getFullName()).isEqualTo("Canonical Organizer");
        assertThat(after.getOrganizationId()).isEqualTo(ORGANIZATION);
        assertProtectedFields(before, userRow(target.getId()));
        assertThat(otherBefore.equals(userRow(other.getId()))).as("unrelated account is byte-for-byte unchanged").isTrue();
        assertTokenRowsUnchanged(sessionsBefore, recoveryBefore);
        assertThat(users.count()).isEqualTo(2);
    }

    @Test
    void doesNotReactivateADisabledUser() {
        User target = user();
        target.setEnabled(false);
        users.saveAndFlush(target);
        Map<String, Object> before = userRow(target.getId());

        metadata.update(request(target));

        assertThat(users.findById(target.getId()).orElseThrow().isEnabled()).isFalse();
        assertProtectedFields(before, userRow(target.getId()));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void rejectsOwnedEmailWithoutDeletingOrMutatingEitherAccount(boolean legacyUppercaseEmail) throws Exception {
        User target = user();
        User owner = user();
        if (legacyUppercaseEmail) {
            owner.setEmail(owner.getEmail().toUpperCase(java.util.Locale.ROOT));
            users.saveAndFlush(owner);
        }
        tokens(target);
        tokens(owner);
        var before = allUserRows();
        var sessionsBefore = sessionRows();
        var recoveryBefore = recoveryRows();
        var request = new UpdateUserMetadataRequest(target.getId(), owner.getEmail().toUpperCase(java.util.Locale.ROOT),
                UserRole.ORGANIZER, "Must Not Persist", ORGANIZATION);

        mvc.perform(put(PATH).header(HeaderConstants.X_INTERNAL_KEY, KEY)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("CONFLICT"));

        assertThat(before.equals(allUserRows())).as("both credential owners and timestamps remain unchanged").isTrue();
        assertTokenRowsUnchanged(sessionsBefore, recoveryBefore);
        assertThat(users.count()).isEqualTo(2);
    }

    @Test
    void nonexistentCanonicalIdNeverCreatesAnIdentityUser() throws Exception {
        User existing = user();
        var before = allUserRows();
        var request = new UpdateUserMetadataRequest(UUID.randomUUID(), existing.getEmail(), UserRole.ORGANIZER, null, ORGANIZATION);

        mvc.perform(put(PATH).header(HeaderConstants.X_INTERNAL_KEY, KEY)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error.code").value("RESOURCE_NOT_FOUND"));

        assertThat(before.equals(allUserRows())).isTrue();
        assertThat(refresh.count()).isZero();
        assertThat(recovery.count()).isZero();
    }

    @Test
    void repeatedIdenticalRequestsAreNoOpsIncludingUpdatedTimestamp() {
        User target = user();
        tokens(target);
        metadata.update(request(target));
        var before = allUserRows();
        var sessionsBefore = sessionRows();
        var recoveryBefore = recoveryRows();

        metadata.update(request(target));

        assertThat(before.equals(allUserRows())).as("identical request does not rewrite any user column").isTrue();
        assertTokenRowsUnchanged(sessionsBefore, recoveryBefore);
    }

    @Test
    void explicitNullsClearOnlyNullableMetadata() {
        User target = user();
        target.setOrganizationId(ORGANIZATION);
        users.saveAndFlush(target);
        Map<String, Object> before = userRow(target.getId());

        metadata.update(new UpdateUserMetadataRequest(target.getId(), target.getEmail(), UserRole.ADMIN, null, null));

        User after = users.findById(target.getId()).orElseThrow();
        assertThat(after.getRole()).isEqualTo(UserRole.ADMIN);
        assertThat(after.getOrganizationId()).isNull();
        assertThat(after.getFullName()).isNull();
        assertProtectedFields(before, userRow(target.getId()));
    }

    @Test
    void loginAndExistingRefreshSessionStillWorkAfterMetadataCorrection() {
        User target = user();
        var login = auth.login(new LoginRequest(target.getUsername(), PASSWORD));
        var sessionsBefore = sessionRows();

        metadata.update(request(target));

        assertThat(sessionsBefore.equals(sessionRows())).as("metadata does not revoke or rotate sessions").isTrue();
        var refreshed = auth.refresh(new RefreshTokenRequest(login.getRefreshToken()));
        assertThat(refreshed.getUser().getId()).isEqualTo(target.getId());
        assertThat(refreshed.getUser().getRole()).isEqualTo(UserRole.ORGANIZER);
        assertThat(refreshed.getUser().getOrganizationId()).isEqualTo(ORGANIZATION);
        for (String identifier : List.of("canonical@metadata.invalid", target.getUsername())) {
            var response = auth.login(new LoginRequest(identifier, PASSWORD));
            assertThat(response.getUser().getId()).isEqualTo(target.getId());
            assertThat(response.getUser().getEmail()).isEqualTo("canonical@metadata.invalid");
        }
        verify(tenant, org.mockito.Mockito.times(4)).check(target.getId());
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"wrong-internal-key", "learnup-internal-secret"})
    void missingInvalidAndDefaultKeysCannotAuthorizeMetadataChanges(String key) throws Exception {
        User target = user();
        var before = allUserRows();
        var call = put(PATH).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request(target)))
                .header(HeaderConstants.X_USER_ID, target.getId().toString())
                .header(HeaderConstants.X_USER_ROLE, "ADMIN")
                .header(HeaderConstants.X_ORGANIZATION_ID, ORGANIZATION.toString());
        if (key != null) call.header(HeaderConstants.X_INTERNAL_KEY, key);

        mvc.perform(call).andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("FORBIDDEN"));

        assertThat(before.equals(allUserRows())).isTrue();
    }

    @Test
    void aUserBearerTokenAloneCannotAuthorizeInternalMetadataChanges() throws Exception {
        User target = user();
        var before = allUserRows();

        mvc.perform(put(PATH).header(HttpHeaders.AUTHORIZATION, "Bearer " + jwt.generateAccessToken(target))
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request(target))))
                .andExpect(status().isForbidden());

        assertThat(before.equals(allUserRows())).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/auth/metadata", "/api/auth/metadata", "/api/v1/credentials/metadata", "/api/credentials/metadata"})
    void thereIsNoPublicMetadataAlias(String path) throws Exception {
        User target = user();
        var before = allUserRows();

        mvc.perform(put(path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request(target))))
                .andExpect(status().isUnauthorized());

        assertThat(before.equals(allUserRows())).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"email", "userId", "role", "longEmail", "longFullName", "invalidOrganization"})
    void validatesMetadataBeforeAnyWrite(String invalid) throws Exception {
        User target = user();
        var before = allUserRows();
        var body = json.valueToTree(request(target));
        var object = (com.fasterxml.jackson.databind.node.ObjectNode) body;
        switch (invalid) {
            case "email" -> object.put("email", "not-an-email");
            case "userId" -> object.remove("userId");
            case "role" -> object.putNull("role");
            case "longEmail" -> object.put("email", "a".repeat(90) + "@metadata.invalid");
            case "longFullName" -> object.put("fullName", "a".repeat(101));
            case "invalidOrganization" -> object.put("organizationId", "not-a-uuid");
            default -> throw new AssertionError("Unknown test case");
        }

        mvc.perform(put(PATH).header(HeaderConstants.X_INTERNAL_KEY, KEY).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body))).andExpect(status().isBadRequest());

        assertThat(before.equals(allUserRows())).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"password", "passwordHash", "username", "enabled", "createdAt"})
    void rejectsFieldsOutsideTheMetadataAllowlistWithoutEchoingValues(String field) throws Exception {
        User target = user();
        var before = allUserRows();
        var body = (com.fasterxml.jackson.databind.node.ObjectNode) json.valueToTree(request(target));
        body.put(field, "synthetic-value-must-not-be-echoed");

        String response = mvc.perform(put(PATH).header(HeaderConstants.X_INTERNAL_KEY, KEY)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();

        assertThat(response).doesNotContain("synthetic-value-must-not-be-echoed", KEY, target.getPasswordHash());
        assertThat(before.equals(allUserRows())).isTrue();
    }

    @Test
    void rejectedKeysAndAccidentalCredentialFieldsNeverEnterLogsOrErrorBodies() throws Exception {
        User target = user();
        String secret = "synthetic-metadata-secret-do-not-log";
        Logger root = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
        ListAppender<ILoggingEvent> captured = new ListAppender<>();
        captured.setContext(root.getLoggerContext());
        captured.start();
        root.addAppender(captured);
        try {
            String rejectedKey = mvc.perform(put(PATH).header(HeaderConstants.X_INTERNAL_KEY, secret)
                            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request(target))))
                    .andExpect(status().isForbidden()).andReturn().getResponse().getContentAsString();
            var body = (com.fasterxml.jackson.databind.node.ObjectNode) json.valueToTree(request(target));
            body.put("password", secret);
            String rejectedBody = mvc.perform(put(PATH).header(HeaderConstants.X_INTERNAL_KEY, KEY)
                            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                    .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();
            String rendered = captured.list.stream().map(event -> event.getFormattedMessage()
                    + (event.getThrowableProxy() == null ? "" : ThrowableProxyUtil.asString(event.getThrowableProxy())))
                    .collect(java.util.stream.Collectors.joining("\n"));
            assertThat(rendered).contains("authentication_rejected", "UNREADABLE_REQUEST", "correlation_id=");
            for (String sensitive : List.of(secret, KEY, target.getPasswordHash())) {
                assertThat((rendered + rejectedKey + rejectedBody).contains(sensitive))
                        .as("no credential value appears in diagnostics or error responses").isFalse();
            }
        } finally {
            root.detachAppender(captured);
            captured.stop();
        }
    }

    @Test
    void failedTransactionRollsBackEvenAfterTheMetadataUpdateWasFlushed() {
        User target = user();
        tokens(target);
        var before = allUserRows();
        var sessionsBefore = sessionRows();
        var recoveryBefore = recoveryRows();
        observation.failAfterFlush = target.getId();

        assertThatThrownBy(() -> metadata.update(request(target))).isInstanceOf(IllegalStateException.class);

        assertThat(before.equals(allUserRows())).as("flushed changes roll back with the service transaction").isTrue();
        assertTokenRowsUnchanged(sessionsBefore, recoveryBefore);
    }

    @Test
    void concurrentEmailClaimsUseTheDatabaseConstraintAndLeaveTheLosingAccountUntouched() throws Exception {
        User first = user();
        User second = user();
        User unrelated = user();
        tokens(first);
        tokens(second);
        tokens(unrelated);
        var firstBefore = userRow(first.getId());
        var secondBefore = userRow(second.getId());
        var unrelatedBefore = userRow(unrelated.getId());
        var sessionsBefore = sessionRows();
        var recoveryBefore = recoveryRows();
        observation.email = "canonical@metadata.invalid";
        observation.completedReads = new CountDownLatch(2);
        var workers = Executors.newFixedThreadPool(2, task -> new Thread(task, WORKER_PREFIX + UUID.randomUUID()));
        try {
            var one = workers.submit(() -> attempt(request(first)));
            var two = workers.submit(() -> attempt(request(second)));
            var outcomes = List.of(one.get(30, TimeUnit.SECONDS), two.get(30, TimeUnit.SECONDS));

            assertThat(observation.completedReads.getCount()).isZero();
            assertThat(observation.constraintFailures.get()).as("both preflights passed; the unique constraint rejects one flush").isEqualTo(1);
            assertThat(outcomes).filteredOn(Outcome::success).hasSize(1);
            outcomes.stream().filter(o -> !o.success()).forEach(o -> {
                assertThat(o.failure()).isInstanceOf(BusinessException.class);
                assertThat(((BusinessException) o.failure()).getErrorCode()).isEqualTo(ErrorCode.CONFLICT);
            });
            UUID winner = outcomes.get(0).success() ? first.getId() : second.getId();
            UUID loser = outcomes.get(0).success() ? second.getId() : first.getId();
            assertThat(userRow(loser).equals(loser.equals(first.getId()) ? firstBefore : secondBefore))
                    .as("losing user's entire row, including credentials, is unchanged").isTrue();
            assertProtectedFields(winner.equals(first.getId()) ? firstBefore : secondBefore, userRow(winner));
            assertThat(unrelatedBefore.equals(userRow(unrelated.getId()))).isTrue();
            assertThat(users.findByEmail("canonical@metadata.invalid").orElseThrow().getId()).isEqualTo(winner);
            assertThat(users.count()).isEqualTo(3);
            assertTokenRowsUnchanged(sessionsBefore, recoveryBefore);
        } finally {
            observation.clear();
            workers.shutdownNow();
            assertThat(workers.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    private Outcome attempt(UpdateUserMetadataRequest request) {
        try {
            metadata.update(request);
            return new Outcome(true, null);
        } catch (RuntimeException failure) {
            return new Outcome(false, failure);
        }
    }

    private User user() {
        UUID id = UUID.randomUUID();
        Instant now = Instant.now();
        return users.saveAndFlush(new User(id, "user_" + id, id + "@metadata.invalid", encoder.encode(PASSWORD),
                "Original Name", UserRole.LEARNER, null, true, now, now));
    }

    private UpdateUserMetadataRequest request(User user) {
        return new UpdateUserMetadataRequest(user.getId(), "CANONICAL@metadata.invalid", UserRole.ORGANIZER,
                "Canonical Organizer", ORGANIZATION);
    }

    private void tokens(User user) {
        Instant now = Instant.now();
        for (boolean consumed : List.of(false, true)) {
            Instant used = consumed ? now.minusSeconds(1) : null;
            refresh.saveAndFlush(new RefreshToken(UUID.randomUUID(), user.getId(), "synthetic-session-" + UUID.randomUUID(),
                    now.plusSeconds(3600), used, now));
            recovery.saveAndFlush(new PasswordResetToken(UUID.randomUUID(), user.getId(), "synthetic-recovery-" + UUID.randomUUID(),
                    now.plusSeconds(600), used, now));
        }
    }

    private Map<String, Object> userRow(UUID id) {
        Map<String, Object> row = new HashMap<>();
        jdbc.queryForMap("SELECT * FROM users WHERE id = ?", id)
                .forEach((key, value) -> row.put(key.toLowerCase(java.util.Locale.ROOT), value));
        return row;
    }

    private List<Map<String, Object>> allUserRows() {
        return jdbc.queryForList("SELECT * FROM users ORDER BY id");
    }

    private List<Map<String, Object>> sessionRows() {
        return jdbc.queryForList("SELECT * FROM refresh_tokens ORDER BY id");
    }

    private List<Map<String, Object>> recoveryRows() {
        return jdbc.queryForList("SELECT * FROM password_reset_tokens ORDER BY id");
    }

    private void assertProtectedFields(Map<String, Object> before, Map<String, Object> after) {
        var oldProtected = new HashMap<>(before);
        var newProtected = new HashMap<>(after);
        for (String allowed : List.of("email", "role", "full_name", "organization_id", "updated_at")) {
            oldProtected.remove(allowed);
            newProtected.remove(allowed);
        }
        // Boolean comparison prevents failure diagnostics from printing credential hashes/token rows.
        assertThat(oldProtected.equals(newProtected)).as("all non-metadata user columns are preserved").isTrue();
    }

    private void assertTokenRowsUnchanged(List<Map<String, Object>> sessionsBefore, List<Map<String, Object>> recoveryBefore) {
        assertThat(sessionsBefore.equals(sessionRows())).as("all refresh-session columns are preserved").isTrue();
        assertThat(recoveryBefore.equals(recoveryRows())).as("all recovery-token columns are preserved").isTrue();
    }

    private record Outcome(boolean success, RuntimeException failure) { }

    @TestConfiguration(proxyBeanMethods = false)
    static class ObservationConfiguration {
        @Bean
        @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
        static RepositoryObservation metadataRepositoryObservation() {
            return new RepositoryObservation();
        }
    }

    /** Observe real queries/flushes, as the existing reset contract does; never fabricate query results. */
    static final class RepositoryObservation implements BeanPostProcessor {
        private volatile String email;
        private volatile CountDownLatch completedReads;
        private volatile UUID failAfterFlush;
        private final AtomicInteger constraintFailures = new AtomicInteger();

        @Override
        public Object postProcessAfterInitialization(Object bean, String name) {
            if (!(bean instanceof UserRepository)) return bean;
            ProxyFactory proxy = new ProxyFactory(bean);
            proxy.addAdvice((MethodInterceptor) invocation -> {
                String method = invocation.getMethod().getName();
                Object result;
                try {
                    result = invocation.proceed();
                } catch (DataIntegrityViolationException conflict) {
                    if ("saveAndFlush".equals(method) && Thread.currentThread().getName().startsWith(WORKER_PREFIX)) {
                        constraintFailures.incrementAndGet();
                    }
                    throw conflict;
                }
                CountDownLatch barrier = completedReads;
                if ("existsByEmailIgnoreCaseAndIdNot".equals(method) && barrier != null && invocation.getArguments()[0].equals(email)
                        && Thread.currentThread().getName().startsWith(WORKER_PREFIX)) {
                    barrier.countDown();
                    if (!barrier.await(10, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Concurrent metadata preflights did not complete");
                    }
                }
                if ("saveAndFlush".equals(method) && invocation.getArguments()[0] instanceof User user
                        && user.getId().equals(failAfterFlush)) {
                    throw new IllegalStateException("Synthetic failure after metadata flush");
                }
                return result;
            });
            return proxy.getProxy();
        }

        private void clear() {
            email = null;
            completedReads = null;
            failAfterFlush = null;
            constraintFailures.set(0);
        }
    }
}
