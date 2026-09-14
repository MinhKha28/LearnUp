package com.learnup.common.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserRoleTest {

    @Test
    @DisplayName("Should contain exactly four valid platform roles")
    void shouldContainExactlyFourRoles() {
        assertThat(UserRole.values()).containsExactly(
                UserRole.ADMIN,
                UserRole.ORGANIZER,
                UserRole.INSTRUCTOR,
                UserRole.LEARNER
        );
    }

    @ParameterizedTest
    @ValueSource(strings = {"ADMIN", "admin", " Admin ", "ORGANIZER", "organizer", "INSTRUCTOR", "instructor", "LEARNER", "learner"})
    @DisplayName("Should successfully parse valid roles with case-insensitivity and trimming")
    void shouldParseValidRoles(String roleStr) {
        UserRole role = UserRole.fromHeader(roleStr);
        assertThat(role).isNotNull();
        assertThat(UserRole.isValid(roleStr)).isTrue();
        assertThat(UserRole.tryParse(roleStr)).contains(role);
    }

    @Test
    @DisplayName("Should return null for null or blank role headers")
    void shouldHandleNullOrBlank() {
        assertThat(UserRole.fromHeader(null)).isNull();
        assertThat(UserRole.fromHeader("")).isNull();
        assertThat(UserRole.fromHeader("   ")).isNull();

        assertThat(UserRole.isValid(null)).isFalse();
        assertThat(UserRole.isValid("")).isFalse();
        assertThat(UserRole.isValid("   ")).isFalse();

        assertThat(UserRole.tryParse(null)).isEmpty();
        assertThat(UserRole.tryParse("")).isEmpty();
        assertThat(UserRole.tryParse("   ")).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"SUPER_ADMIN", "TENANT_ADMIN", "ORG_ADMIN", "MANAGER", "HACKER", "USER"})
    @DisplayName("Should throw IllegalArgumentException and reject invalid or unapproved roles")
    void shouldRejectInvalidRoles(String invalidRole) {
        assertThatThrownBy(() -> UserRole.fromHeader(invalidRole))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid user role: '" + invalidRole + "'");

        assertThat(UserRole.isValid(invalidRole)).isFalse();
        assertThat(UserRole.tryParse(invalidRole)).isEmpty();
    }
}
