package com.learnup.identity.config;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DevAccountSeederTest {

    private ApplicationContextRunner runner(String profile) {
        return new ApplicationContextRunner().withUserConfiguration(DevAccountSeeder.class)
                .withPropertyValues("spring.profiles.active=" + profile);
    }

    @ParameterizedTest
    @ValueSource(strings = {"default", "dev", "local", "test", "local-docs", "docker", "prod", "production",
            "staging", "local,prod", "local-docs,docker"})
    void shouldDefaultToNoStartupSeedingInEveryProfile(String profile) {
        runner(profile).run(context -> {
            assertThat(context).hasNotFailed().hasSingleBean(DevAccountSeeder.class);
            assertThatCode(() -> context.getBean(DevAccountSeeder.class).run()).doesNotThrowAnyException();
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"default", "dev", "local", "test", "local-docs", "docker", "prod", "production",
            "staging", "local,prod", "local-docs,docker"})
    void shouldRejectEvenExplicitLocalOptInUntilTenantOwnsTheFixtureContract(String profile) {
        // Deliberate safe fallback: there is no supported Identity-only seeding mode, even locally.
        runner(profile).withPropertyValues("learnup.seed.enabled=true").run(context -> {
            assertThat(context).hasNotFailed();
            assertThatThrownBy(() -> context.getBean(DevAccountSeeder.class).run())
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Automatic Identity demo seeding is unavailable")
                    .hasMessageContaining("Tenant-owned fixture provisioning");
        });
    }
}
