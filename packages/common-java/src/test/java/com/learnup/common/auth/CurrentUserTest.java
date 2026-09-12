package com.learnup.common.auth;

import com.learnup.common.constant.RoleConstants;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CurrentUserTest {

    @Test
    @DisplayName("Should verify role checks accurately")
    void shouldVerifyRoleChecks() {
        CurrentUser organizer = CurrentUser.builder()
                .userId("usr_123")
                .organizationId("org_456")
                .role(RoleConstants.ORGANIZER)
                .build();

        assertThat(organizer.isOrganizer()).isTrue();
        assertThat(organizer.isAdmin()).isFalse();
        assertThat(organizer.isInstructor()).isFalse();
        assertThat(organizer.isLearner()).isFalse();
        assertThat(organizer.hasRole("organizer")).isTrue();
        assertThat(organizer.hasRole("ADMIN")).isFalse();
    }

    @Test
    @DisplayName("Should verify organization membership correctly")
    void shouldVerifyOrganizationMembership() {
        CurrentUser user = CurrentUser.builder()
                .userId("usr_123")
                .organizationId("org_456")
                .role(RoleConstants.LEARNER)
                .build();

        assertThat(user.belongsToOrganization("org_456")).isTrue();
        assertThat(user.belongsToOrganization("org_999")).isFalse();
        assertThat(user.belongsToOrganization(null)).isFalse();
    }
}
