package com.learnup.common.context;

import com.learnup.common.auth.CurrentUser;
import com.learnup.common.constant.RoleConstants;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SecurityContextHolderTest {

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    @Test
    @DisplayName("Should synchronize CurrentUser with TenantContext")
    void shouldSyncUserAndTenant() {
        CurrentUser user = CurrentUser.builder()
                .userId("usr_1")
                .organizationId("org_tenant_1")
                .role(RoleConstants.ORGANIZER)
                .build();

        SecurityContextHolder.setCurrentUser(user);

        assertThat(SecurityContextHolder.getCurrentUser()).isEqualTo(user);
        assertThat(SecurityContextHolder.requireCurrentUser()).isEqualTo(user);
        assertThat(TenantContext.getOrganizationId()).isEqualTo("org_tenant_1");

        SecurityContextHolder.clear();
        assertThat(SecurityContextHolder.getCurrentUser()).isNull();
        assertThat(TenantContext.getOrganizationId()).isNull();
    }

    @Test
    @DisplayName("Should throw IllegalStateException on requireCurrentUser when context is empty")
    void shouldThrowWhenUserMissing() {
        assertThatThrownBy(SecurityContextHolder::requireCurrentUser)
                .isInstanceOf(IllegalStateException.class);
    }
}
