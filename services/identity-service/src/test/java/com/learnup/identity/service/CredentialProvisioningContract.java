package com.learnup.identity.service;

import com.learnup.common.security.UserRole;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.LoginRequest;
import com.learnup.identity.dto.internal.SetCredentialsRequest;
import com.learnup.identity.dto.internal.SignInAccess;
import com.learnup.identity.repository.LoginThrottleRepository;
import com.learnup.identity.repository.PasswordResetTokenRepository;
import com.learnup.identity.repository.RefreshTokenRepository;
import com.learnup.identity.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Actual persistence/transaction contract, reused by H2 and migrated disposable PostgreSQL.
 * No test-wide transaction: service calls and concurrent workers commit independently.
 * Only Tenant access decisions are mocked; canonical IDs are supplied as Tenant does.
 */
abstract class CredentialProvisioningContract {

    private static final String PASSWORD = "SyntheticProvisioningPassword!31";
    private static final UUID ORGANIZATION_ID = UUID.fromString("01990000-0000-7000-8000-000000000100");

    @Autowired private AuthService authService;
    @Autowired private UserRepository users;
    @Autowired private RefreshTokenRepository refreshTokens;
    @Autowired private PasswordResetTokenRepository resetTokens;
    @Autowired private LoginThrottleRepository loginThrottles;
    @Autowired private PasswordEncoder passwordEncoder;
    @MockBean private TenantAccessClient tenantAccessClient;

    @BeforeEach
    void clearIsolatedDatabase() {
        when(tenantAccessClient.check(any())).thenReturn(new SignInAccess(true, "Full", null));
        loginThrottles.deleteAll();
        resetTokens.deleteAll();
        refreshTokens.deleteAll();
        users.deleteAll();
    }

    @Test
    void provisionsUuidV7UsersWithSharedTimestampPrefix() {
        for (int index = 0; index < 16; index++) {
            SetCredentialsRequest request = request(index);
            assertThat(request.getUserId().version()).isEqualTo(7);
            authService.setCredentials(request);
        }

        assertThat(users.count()).isEqualTo(16);
        for (int index = 0; index < 16; index++) {
            assertProvisioned(request(index));
        }
        assertThat(users.findAll()).extracting(User::getUsername).doesNotHaveDuplicates();
    }

    @Test
    void concurrentUuidV7ProvisioningKeepsDistinctUsernames() throws Exception {
        int count = 8;
        CountDownLatch ready = new CountDownLatch(count);
        CountDownLatch start = new CountDownLatch(1);
        var workers = Executors.newFixedThreadPool(count);
        List<Future<?>> completions = new ArrayList<>();
        try {
            for (int index = 0; index < count; index++) {
                SetCredentialsRequest request = request(index);
                completions.add(workers.submit(() -> {
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Provisioning workers did not start together");
                    }
                    authService.setCredentials(request);
                    return null;
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            for (Future<?> completion : completions) {
                completion.get(30, TimeUnit.SECONDS);
            }
        } finally {
            start.countDown();
            workers.shutdownNow();
            assertThat(workers.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }

        assertThat(users.count()).isEqualTo(count);
        for (int index = 0; index < count; index++) {
            assertProvisioned(request(index));
        }
        assertThat(users.findAll()).extracting(User::getUsername).doesNotHaveDuplicates();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = "   ")
    void reprovisioningCanonicalUserWithoutUsernameKeepsStableIdentity(String omittedUsername) {
        SetCredentialsRequest request = request(0);
        request.setUsername(omittedUsername);
        authService.setCredentials(request);
        User before = users.findById(request.getUserId()).orElseThrow();

        authService.setCredentials(request);

        User after = assertProvisioned(request);
        assertThat(after.getId()).isEqualTo(before.getId());
        assertThat(after.getUsername()).isEqualTo(before.getUsername());
        assertThat(after.getEmail()).isEqualTo(before.getEmail());
        assertThat(after.getCreatedAt()).isEqualTo(before.getCreatedAt());
        assertThat(users.count()).isEqualTo(1);
    }

    @Test
    void explicitUsernameStillTakesPrecedence() {
        SetCredentialsRequest request = request(0);
        request.setUsername("  assigned_username  ");

        authService.setCredentials(request);

        User user = users.findById(request.getUserId()).orElseThrow();
        assertThat(user.getId()).isEqualTo(request.getUserId());
        assertThat(user.getUsername()).isEqualTo("assigned_username");
        assertThat(passwordEncoder.matches(PASSWORD, user.getPasswordHash())).isTrue();
    }

    @Test
    void provisioningNewUsersDoesNotRenameOrMutateAnExistingLegacyAccount() {
        User legacy = legacyAccount();
        User before = users.findById(legacy.getId()).orElseThrow();

        authService.setCredentials(request(0));

        User after = users.findById(legacy.getId()).orElseThrow();
        assertThat(after.getId()).isEqualTo(before.getId());
        assertThat(after.getUsername()).isEqualTo(before.getUsername());
        assertThat(after.getEmail()).isEqualTo(before.getEmail());
        assertThat(after.getRole()).isEqualTo(before.getRole());
        assertThat(after.getOrganizationId()).isEqualTo(before.getOrganizationId());
        assertThat(after.isEnabled()).isEqualTo(before.isEnabled());
        assertThat(after.getCreatedAt()).isEqualTo(before.getCreatedAt());
        assertThat(after.getUpdatedAt()).isEqualTo(before.getUpdatedAt());
        assertThat(after.getPasswordHash().equals(before.getPasswordHash()))
                .as("Unrelated existing credentials must not change").isTrue();
        assertThat(users.count()).isEqualTo(2);
        assertProvisioned(request(0));
    }

    @Test
    void credentialReplacementWithoutUsernamePreservesLegacyUsername() {
        User legacy = legacyAccount();
        SetCredentialsRequest request = new SetCredentialsRequest(legacy.getId(), PASSWORD);

        authService.setCredentials(request);

        User after = users.findById(legacy.getId()).orElseThrow();
        assertThat(after.getId()).isEqualTo(legacy.getId());
        assertThat(after.getUsername()).isEqualTo("user_01990000");
        assertThat(after.getEmail()).isEqualTo(legacy.getEmail());
        assertThat(passwordEncoder.matches(PASSWORD, after.getPasswordHash())).isTrue();
        assertThat(users.count()).isEqualTo(1);
    }

    @Test
    void emailAndUsernameLoginContractsStillCheckCanonicalTenantAccess() {
        SetCredentialsRequest request = request(0);
        authService.setCredentials(request);
        String username = "user_" + request.getUserId();

        for (String identifier : List.of(request.getEmail(), username)) {
            var response = authService.login(new LoginRequest(identifier, PASSWORD));
            assertThat(response.getUser().getId()).isEqualTo(request.getUserId());
            assertThat(response.getUser().getUsername()).isEqualTo(username);
            assertThat(response.getUser().getRole()).isEqualTo(request.getRole());
            assertThat(response.getUser().getOrganizationId()).isEqualTo(ORGANIZATION_ID);
            assertThat(response.getAccessToken()).isNotBlank();
            assertThat(response.getRefreshToken()).isNotBlank();
        }
        verify(tenantAccessClient, times(2)).check(request.getUserId());
    }

    @Test
    void databaseStillRejectsAnExplicitDuplicateUsername() {
        SetCredentialsRequest first = request(0);
        authService.setCredentials(first);
        SetCredentialsRequest second = request(1);
        second.setUsername("user_" + first.getUserId());

        assertThatThrownBy(() -> authService.setCredentials(second))
                .isInstanceOf(DataIntegrityViolationException.class);

        assertThat(users.count()).isEqualTo(1);
        assertThat(users.findById(second.getUserId())).isEmpty();
        assertProvisioned(first);
    }

    private User assertProvisioned(SetCredentialsRequest request) {
        User user = users.findById(request.getUserId()).orElseThrow();
        assertThat(user.getId()).isEqualTo(request.getUserId());
        assertThat(user.getUsername()).isEqualTo("user_" + request.getUserId()).hasSize(41);
        assertThat(user.getEmail()).isEqualTo(request.getEmail());
        assertThat(user.getRole()).isEqualTo(request.getRole());
        assertThat(user.getOrganizationId()).isEqualTo(request.getOrganizationId());
        assertThat(user.isEnabled()).isTrue();
        assertThat(passwordEncoder.matches(PASSWORD, user.getPasswordHash())).isTrue();
        return user;
    }

    private User legacyAccount() {
        Instant now = Instant.now();
        return users.saveAndFlush(new User(canonicalId(100), "user_01990000", "legacy@provisioning.test",
                passwordEncoder.encode(PASSWORD), "Legacy User", UserRole.LEARNER, ORGANIZATION_ID, true, now, now));
    }

    private SetCredentialsRequest request(int index) {
        UserRole role = List.of(UserRole.ORGANIZER, UserRole.INSTRUCTOR, UserRole.LEARNER).get(index % 3);
        return new SetCredentialsRequest(canonicalId(index), PASSWORD, null,
                "provisioned" + index + "@provisioning.test", "Provisioned User " + index, role, ORGANIZATION_ID);
    }

    private UUID canonicalId(int index) {
        // Deliberately identical timestamp bits, valid UUIDv7 version/variant;
        // the differing low bits represent distinct canonical Tenant accounts.
        return UUID.fromString("01990000-0000-7000-8000-" + String.format("%012x", index));
    }
}
