package com.learnup.common.context;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TenantContextTest {

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("Should set, get, and clear organizationId")
    void shouldManageTenantContext() {
        assertThat(TenantContext.isSet()).isFalse();

        TenantContext.setOrganizationId("org_abc");
        assertThat(TenantContext.isSet()).isTrue();
        assertThat(TenantContext.getOrganizationId()).isEqualTo("org_abc");
        assertThat(TenantContext.requireOrganizationId()).isEqualTo("org_abc");

        TenantContext.clear();
        assertThat(TenantContext.isSet()).isFalse();
        assertThat(TenantContext.getOrganizationId()).isNull();
    }

    @Test
    @DisplayName("Should throw IllegalStateException when requireOrganizationId called on empty context")
    void shouldThrowWhenTenantMissing() {
        assertThatThrownBy(TenantContext::requireOrganizationId)
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("Should execute scoped runnable with runWithTenant and restore previous state")
    void shouldRunWithTenant() {
        TenantContext.setOrganizationId("org_parent");

        String result = TenantContext.runWithTenant("org_child", () -> {
            assertThat(TenantContext.getOrganizationId()).isEqualTo("org_child");
            return "scoped_result";
        });

        assertThat(result).isEqualTo("scoped_result");
        assertThat(TenantContext.getOrganizationId()).isEqualTo("org_parent");
    }
}
