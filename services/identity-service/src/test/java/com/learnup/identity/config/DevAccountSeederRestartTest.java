package com.learnup.identity.config;

import com.learnup.common.security.UserRole;
import com.learnup.identity.IdentityServiceApplication;
import com.learnup.identity.domain.PasswordResetToken;
import com.learnup.identity.domain.RefreshToken;
import com.learnup.identity.domain.User;
import com.learnup.identity.repository.PasswordResetTokenRepository;
import com.learnup.identity.repository.RefreshTokenRepository;
import com.learnup.identity.repository.UserRepository;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Two real Boot startups against the same private H2 database, never a shared PostgreSQL database. */
class DevAccountSeederRestartTest {

    @ParameterizedTest
    @ValueSource(strings = {"default", "docker"})
    void actualRestartShouldPreserveChangedPasswordsDeactivationConflictsAndTokens(String profile) {
        String database = "jdbc:h2:mem:seeder_restart_" + UUID.randomUUID()
                + ";DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;MODE=PostgreSQL";
        UUID learnerId = UUID.fromString("01900000-0000-7000-8000-00000000a201");
        UUID organizerId = UUID.fromString("01900000-0000-7000-8000-00000000a010");
        UUID conflictingId = UUID.randomUUID();
        String changedPassword = "SyntheticChangedLocalPassword123!";
        String changedHash;
        String disabledHash;
        String conflictingHash;
        Instant updatedAt;
        UUID refreshId;
        UUID resetId;

        try (ConfigurableApplicationContext first = start(database, profile)) {
            UserRepository users = first.getBean(UserRepository.class);
            assertThat(users.count()).isZero(); // Real startup defaults must not create even a demo Admin.
            PasswordEncoder encoder = first.getBean(PasswordEncoder.class);
            User learner = user(learnerId, "learner", "learner@learnup.local", UserRole.LEARNER,
                    encoder.encode(changedPassword), true);
            User disabled = user(organizerId, "organizer", "organizer@learnup.local", UserRole.ORGANIZER,
                    encoder.encode("SyntheticDisabledPassword123!"), false);
            User conflict = user(conflictingId, "admin", "admin@learnup.local", UserRole.LEARNER,
                    encoder.encode("SyntheticConflictPassword123!"), true);
            users.saveAllAndFlush(List.of(learner, disabled, conflict));
            changedHash = users.findById(learnerId).orElseThrow().getPasswordHash();
            disabledHash = users.findById(organizerId).orElseThrow().getPasswordHash();
            conflictingHash = users.findById(conflictingId).orElseThrow().getPasswordHash();
            updatedAt = users.findById(learnerId).orElseThrow().getUpdatedAt();

            RefreshToken refresh = new RefreshToken();
            refresh.setUserId(conflictingId);
            refresh.setTokenHash("synthetic-persisted-refresh-hash");
            refresh.setExpiresAt(Instant.now().plusSeconds(3600));
            refreshId = first.getBean(RefreshTokenRepository.class).saveAndFlush(refresh).getId();
            PasswordResetToken reset = new PasswordResetToken();
            reset.setUserId(conflictingId);
            reset.setTokenHash("synthetic-persisted-reset-hash");
            reset.setExpiresAt(Instant.now().plusSeconds(900));
            resetId = first.getBean(PasswordResetTokenRepository.class).saveAndFlush(reset).getId();
        }

        try (ConfigurableApplicationContext second = start(database, profile)) {
            UserRepository users = second.getBean(UserRepository.class);
            assertThat(users.count()).isEqualTo(3);
            User learner = users.findById(learnerId).orElseThrow();
            assertThat(learner.getPasswordHash()).isEqualTo(changedHash);
            assertThat(second.getBean(PasswordEncoder.class).matches(changedPassword, learner.getPasswordHash())).isTrue();
            assertThat(learner.getUpdatedAt()).isEqualTo(updatedAt);
            User disabled = users.findById(organizerId).orElseThrow();
            assertThat(disabled.isEnabled()).isFalse();
            assertThat(disabled.getPasswordHash()).isEqualTo(disabledHash);
            User conflict = users.findById(conflictingId).orElseThrow();
            assertThat(conflict.getPasswordHash()).isEqualTo(conflictingHash);
            assertThat(conflict.getRole()).isEqualTo(UserRole.LEARNER);
            assertThat(users.findByUsername("admin")).get().extracting(User::getId).isEqualTo(conflictingId);
            assertThat(users.existsById(UUID.fromString("01900000-0000-7000-8000-000000000001"))).isFalse();
            assertThat(second.getBean(RefreshTokenRepository.class).findById(refreshId)).isPresent();
            assertThat(second.getBean(PasswordResetTokenRepository.class).findById(resetId)).isPresent();
            assertThat(second.getBean(RefreshTokenRepository.class).count()).isEqualTo(1);
            assertThat(second.getBean(PasswordResetTokenRepository.class).count()).isEqualTo(1);
        }
    }

    private ConfigurableApplicationContext start(String database, String profile) {
        // Command-line properties outrank shell configuration so this can never reach a developer's database.
        // update is intentional only for this private H2 database, allowing persistence across two JVM contexts.
        return SpringApplication.run(IdentityServiceApplication.class,
                "--spring.profiles.active=" + profile,
                "--spring.datasource.url=" + database,
                "--spring.datasource.driver-class-name=org.h2.Driver",
                "--spring.datasource.username=sa", "--spring.datasource.password=",
                "--spring.jpa.hibernate.ddl-auto=update", "--spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
                "--spring.flyway.enabled=false", "--eureka.client.enabled=false",
                "--security.jwt.secret=syntheticRestartSigningKeyAtLeast32BytesLong!",
                "--security.internal-key=syntheticRestartInternalKeyAtLeast32BytesLong!",
                "--learnup.recovery.notification-base-url=http://127.0.0.1:65534",
                "--learnup.recovery.frontend-base-url=http://127.0.0.1:5173",
                "--learnup.recovery.delivery-enabled=false",
                "--server.address=127.0.0.1", "--server.port=0", "--management.server.port=0",
                "--spring.main.banner-mode=off");
    }

    private User user(UUID id, String username, String email, UserRole role, String hash, boolean enabled) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setEmail(email);
        user.setRole(role);
        user.setPasswordHash(hash);
        user.setEnabled(enabled);
        return user;
    }
}
