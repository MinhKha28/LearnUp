package com.learnup.identity.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Fail-closed compatibility guard for the retired automatic demo seeder.
 * Tenant must establish canonical accounts before provisioning Identity credentials.
 * A sign-in access verdict alone is not a canonical account fixture contract.
 */
@Component
public class DevAccountSeeder implements CommandLineRunner {

    private final boolean seedEnabled;

    public DevAccountSeeder(@Value("${learnup.seed.enabled:false}") boolean seedEnabled) {
        this.seedEnabled = seedEnabled;
    }

    @Override
    public void run(String... args) {
        if (seedEnabled) {
            throw new IllegalStateException("Automatic Identity demo seeding is unavailable; keep learnup.seed.enabled=false "
                    + "and coordinate Tenant-owned fixture provisioning. See Identity DEVELOPMENT.md.");
        }
        // Never create, delete, reset, re-enable or otherwise mutate credentials on startup.
    }
}
