package com.learnup.common.logging;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

import static org.assertj.core.api.Assertions.assertThat;

class StructuredLogHelperTest {

    @AfterEach
    void tearDown() {
        StructuredLogHelper.clear();
    }

    @Test
    @DisplayName("Should set and clear MDC keys properly")
    void shouldManageMdcKeys() {
        StructuredLogHelper.setOrganizationId("org_test");
        StructuredLogHelper.setUserId("usr_test");
        StructuredLogHelper.setCorrelationId("corr_test");
        StructuredLogHelper.setServiceName("identity-service");

        assertThat(MDC.get(StructuredLogHelper.MDC_ORGANIZATION_ID)).isEqualTo("org_test");
        assertThat(MDC.get(StructuredLogHelper.MDC_USER_ID)).isEqualTo("usr_test");
        assertThat(MDC.get(StructuredLogHelper.MDC_CORRELATION_ID)).isEqualTo("corr_test");
        assertThat(MDC.get(StructuredLogHelper.MDC_SERVICE_NAME)).isEqualTo("identity-service");

        StructuredLogHelper.clear();

        assertThat(MDC.get(StructuredLogHelper.MDC_ORGANIZATION_ID)).isNull();
        assertThat(MDC.get(StructuredLogHelper.MDC_USER_ID)).isNull();
    }

    @Test
    @DisplayName("Should scope execution with withContext supplier and restore previous context")
    void shouldExecuteWithContext() {
        StructuredLogHelper.setOrganizationId("org_outer");

        String result = StructuredLogHelper.withContext("org_inner", "usr_inner", "corr_inner", () -> {
            assertThat(MDC.get(StructuredLogHelper.MDC_ORGANIZATION_ID)).isEqualTo("org_inner");
            assertThat(MDC.get(StructuredLogHelper.MDC_USER_ID)).isEqualTo("usr_inner");
            return "scoped_success";
        });

        assertThat(result).isEqualTo("scoped_success");
        assertThat(MDC.get(StructuredLogHelper.MDC_ORGANIZATION_ID)).isEqualTo("org_outer");
        assertThat(MDC.get(StructuredLogHelper.MDC_USER_ID)).isNull();
    }
}
