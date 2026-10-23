package com.learnup.identity.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PasswordRecoveryPropertiesTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(ConfigurationPropertiesAutoConfiguration.class))
            .withUserConfiguration(PasswordRecoveryProperties.class);

    @Test
    void bothExplicitDestinationsAreRequiredAtStartup() {
        runner.run(context -> assertThat(context).hasFailed());
        runner.withPropertyValues("learnup.recovery.frontend-base-url=https://learnup.example")
                .run(context -> assertThat(context).hasFailed());
        runner.withPropertyValues("learnup.recovery.notification-base-url=http://notification-service:8087")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void validExplicitSettingsBindWithBoundedDefaults() {
        runner.withPropertyValues("learnup.recovery.notification-base-url=http://notification-service:8087",
                        "learnup.recovery.frontend-base-url=https://learnup.example/app/")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    PasswordRecoveryProperties properties = context.getBean(PasswordRecoveryProperties.class);
                    assertThat(properties.getConnectTimeoutMillis()).isEqualTo(2000);
                    assertThat(properties.getReadTimeoutMillis()).isEqualTo(5000);
                    assertThat(properties.getMaxRequestsPerWindow()).isEqualTo(3);
                    assertThat(properties.getWindowMinutes()).isEqualTo(15);
                    assertThat(properties.getWorkerThreads()).isEqualTo(2);
                    assertThat(properties.getQueueCapacity()).isEqualTo(100);
                    assertThat(properties.recoveryUrl("opaque/token ?# +"))
                            .isEqualTo("https://learnup.example/app/reset-password/opaque%2Ftoken%20%3F%23%20%2B");
                });
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://localhost:3000", "http://127.0.0.1:5173/", "http://[::1]:3000"})
    void loopbackDevelopmentFrontendCanUseHttp(String baseUrl) {
        PasswordRecoveryProperties properties = validProperties();
        properties.setFrontendBaseUrl(baseUrl);
        properties.afterPropertiesSet();
        assertThat(properties.recoveryUrl("synthetic-token")).startsWith(baseUrl.replaceFirst("/+$", "") + "/reset-password/");
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://notification-service:8087", "https://notification.internal", "http://notification.svc.cluster.local",
            "http://10.1.2.3:8087", "http://172.16.0.2:8087", "http://192.168.0.2:8087", "http://[fd00::1]:8087"})
    void privateNotificationDestinationsAreAcceptedWithoutDnsLookup(String baseUrl) {
        PasswordRecoveryProperties properties = validProperties();
        properties.setNotificationBaseUrl(baseUrl);
        properties.afterPropertiesSet();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "http://public.example", "https://8.8.8.8", "http://169.254.169.254", "file:///tmp/notification",
            "http://user:synthetic-secret@notification-service", "http://notification-service?secret=synthetic-secret",
            "http://notification-service#synthetic-secret", "http://notification-service\\@public.example", "http://10.999.0.1",
            "http://notification-service:0", "http://notification-service:65536"})
    void unsafeNotificationDestinationsAreRejectedWithoutEchoingTheValue(String baseUrl) {
        PasswordRecoveryProperties properties = validProperties();
        properties.setNotificationBaseUrl(baseUrl);
        assertThatThrownBy(properties::afterPropertiesSet).isInstanceOf(IllegalStateException.class)
                .hasMessageNotContaining("synthetic-secret");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "http://learnup.example", "//learnup.example", "javascript:synthetic-secret",
            "https://user:synthetic-secret@learnup.example", "https://learnup.example?secret=synthetic-secret",
            "https://learnup.example#synthetic-secret", "https://learnup.example\\@public.example", "https://learnup.example:65536"})
    void unsafeFrontendDestinationsAreRejectedWithoutEchoingTheValue(String baseUrl) {
        PasswordRecoveryProperties properties = validProperties();
        properties.setFrontendBaseUrl(baseUrl);
        assertThatThrownBy(properties::afterPropertiesSet).isInstanceOf(IllegalStateException.class)
                .hasMessageNotContaining("synthetic-secret");
    }

    @ParameterizedTest
    @CsvSource({"connect-timeout-millis,99", "connect-timeout-millis,10001", "read-timeout-millis,99", "read-timeout-millis,15001",
            "max-requests-per-window,0", "max-requests-per-window,21", "window-minutes,0", "window-minutes,61",
            "worker-threads,0", "worker-threads,9", "queue-capacity,0", "queue-capacity,1001"})
    void resourceLimitsCannotBeDisabledOrMadeUnbounded(String property, int value) {
        runner.withPropertyValues("learnup.recovery.notification-base-url=http://notification-service:8087",
                        "learnup.recovery.frontend-base-url=https://learnup.example", "learnup.recovery." + property + "=" + value)
                .run(context -> assertThat(context).hasFailed());
    }

    static PasswordRecoveryProperties validProperties() {
        PasswordRecoveryProperties properties = new PasswordRecoveryProperties();
        properties.setNotificationBaseUrl("http://notification-service:8087");
        properties.setFrontendBaseUrl("https://learnup.example");
        return properties;
    }
}
