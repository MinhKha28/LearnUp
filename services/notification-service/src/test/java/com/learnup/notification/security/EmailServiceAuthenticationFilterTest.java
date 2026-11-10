package com.learnup.notification.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThatIllegalStateException;

class EmailServiceAuthenticationFilterTest {
    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "short", "learnup-internal-secret", "     learnup-internal-secret          "})
    void rejectsMissingWeakAndRepositoryDefaultConfiguration(String key) {
        assertThatIllegalStateException()
                .isThrownBy(() -> new EmailServiceAuthenticationFilter(key, new ObjectMapper()))
                .withMessage("security.internal-key requires a private value of at least 32 bytes");
    }
}
