package com.learnup.identity.config;

import com.learnup.common.security.UserRole;
import com.learnup.identity.domain.User;
import com.learnup.identity.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Arrays;
import java.util.UUID;

/**
 * Repeatable, idempotent development and demo account provisioner for Identity Service.
 * Restricted to non-production environments (!prod).
 *
 * Automatically provisions canonical demo credentials matching Tenant Service IDs:
 * - ADMIN: admin@learnup.local (ID: 01900000-0000-7000-8000-000000000001)
 * - ORGANIZER: organizer@learnup.local (ID: 01900000-0000-7000-8000-00000000a010, Org: ABC)
 * - INSTRUCTOR: instructor@learnup.local (ID: 01900000-0000-7000-8000-00000000a101, Org: ABC)
 * - LEARNER: learner@learnup.local (ID: 01900000-0000-7000-8000-00000000a201, Org: ABC)
 */
@Component
@Profile("!prod")
public class DevAccountSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DevAccountSeeder.class);

    public static final UUID ADMIN_ID = UUID.fromString("01900000-0000-7000-8000-000000000001");
    public static final UUID ORGANIZER_ID = UUID.fromString("01900000-0000-7000-8000-00000000a010");
    public static final UUID INSTRUCTOR_ID = UUID.fromString("01900000-0000-7000-8000-00000000a101");
    public static final UUID LEARNER_ID = UUID.fromString("01900000-0000-7000-8000-00000000a201");
    public static final UUID DEMO_ORG_ID = UUID.fromString("01900000-0000-7000-8000-00000000a001");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final Environment environment;

    @Value("${learnup.seed.enabled:true}")
    private boolean seedEnabled;

    @Value("${learnup.seed.default-password:LearnUp@123}")
    private String defaultPassword;

    public DevAccountSeeder(UserRepository userRepository,
                            PasswordEncoder passwordEncoder,
                            Environment environment) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.environment = environment;
    }

    @Override
    public void run(String... args) {
        // Skip automatic seeding when running within test profile unless explicitly triggered
        if (Arrays.asList(environment.getActiveProfiles()).contains("test")) {
            return;
        }

        if (!seedEnabled) {
            log.info("Development account seeding is disabled via configuration");
            return;
        }

        seedAccounts();
    }

    public void seedAccounts() {
        log.info("Checking and provisioning development seed accounts in identity_db...");

        seedUser(ADMIN_ID, "admin", "admin@learnup.local", "LearnUP Platform Administrator", UserRole.ADMIN, null);
        seedUser(ORGANIZER_ID, "organizer", "organizer@learnup.local", "Nguyễn Thị Lan (Organizer)", UserRole.ORGANIZER, DEMO_ORG_ID);
        seedUser(INSTRUCTOR_ID, "instructor", "instructor@learnup.local", "Trần Văn Minh (Instructor)", UserRole.INSTRUCTOR, DEMO_ORG_ID);
        seedUser(LEARNER_ID, "learner", "learner@learnup.local", "Nguyễn Văn An (Learner)", UserRole.LEARNER, DEMO_ORG_ID);

        log.info("Development seed accounts are ready in identity_db.");
    }

    private void seedUser(UUID id, String username, String email, String fullName, UserRole role, UUID organizationId) {
        User user = userRepository.findById(id).orElse(null);
        if (user == null) {
            // Clean up any stale conflicts by username or email
            userRepository.findByUsername(username).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    userRepository.delete(existing);
                    userRepository.flush();
                }
            });
            userRepository.findByEmail(email).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    userRepository.delete(existing);
                    userRepository.flush();
                }
            });

            user = new User();
            user.setId(id);
            user.setCreatedAt(Instant.now());
        }

        user.setUsername(username);
        user.setEmail(email);
        user.setFullName(fullName);
        user.setRole(role);
        user.setOrganizationId(organizationId);
        user.setEnabled(true);
        user.setUpdatedAt(Instant.now());

        if (user.getPasswordHash() == null || !passwordEncoder.matches(defaultPassword, user.getPasswordHash())) {
            user.setPasswordHash(passwordEncoder.encode(defaultPassword));
        }

        userRepository.save(user);
        log.info("Seed account '{}' ({}) with role [{}] is ready.", username, email, role);
    }
}
