package com.learnup.common.context;

import com.learnup.common.security.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class RequestContextHolderTest {

    @AfterEach
    void tearDown() {
        RequestContextHolder.clear();
    }

    @Test
    @DisplayName("Should bind and retrieve context correctly via RequestContextHolder and helper classes")
    void shouldBindAndRetrieveContext() {
        UUID userId = UUID.randomUUID();
        UUID orgId = UUID.randomUUID();
        String correlationId = "test-correlation-123";

        RequestContext context = RequestContext.builder()
                .userId(userId.toString())
                .organizationId(orgId.toString())
                .role(UserRole.ORGANIZER)
                .correlationId(correlationId)
                .build();

        RequestContextHolder.set(context);

        // Verify RequestContextHolder
        assertThat(RequestContextHolder.get()).isEqualTo(context);
        assertThat(RequestContextHolder.getUserId()).isEqualTo(userId.toString());
        assertThat(RequestContextHolder.getUserIdAsUuid()).isEqualTo(userId);
        assertThat(RequestContextHolder.getOrganizationId()).isEqualTo(orgId.toString());
        assertThat(RequestContextHolder.getOrganizationIdAsUuid()).isEqualTo(orgId);
        assertThat(RequestContextHolder.getRole()).isEqualTo(UserRole.ORGANIZER);
        assertThat(RequestContextHolder.getCorrelationId()).isEqualTo(correlationId);

        // Verify CurrentUser helper
        assertThat(CurrentUser.getUserId()).isEqualTo(userId.toString());
        assertThat(CurrentUser.getUserIdAsUuid()).isEqualTo(userId);
        assertThat(CurrentUser.getRole()).isEqualTo(UserRole.ORGANIZER);
        assertThat(CurrentUser.getOrganizationId()).isEqualTo(orgId.toString());
        assertThat(CurrentUser.getOrganizationIdAsUuid()).isEqualTo(orgId);
        assertThat(CurrentUser.isAuthenticated()).isTrue();
        assertThat(CurrentUser.hasRole(UserRole.ORGANIZER)).isTrue();
        assertThat(CurrentUser.hasRole(UserRole.ADMIN)).isFalse();

        // Verify OrganizationContext helper
        assertThat(OrganizationContext.getOrganizationId()).isEqualTo(orgId.toString());
        assertThat(OrganizationContext.getOrganizationIdAsUuid()).isEqualTo(orgId);
        assertThat(OrganizationContext.hasOrganization()).isTrue();

        // Verify CorrelationContext helper
        assertThat(CorrelationContext.getCorrelationId()).isEqualTo(correlationId);
    }

    @Test
    @DisplayName("Should return null and false when context is empty or cleared")
    void shouldReturnDefaultsWhenContextIsEmpty() {
        assertThat(RequestContextHolder.get()).isNull();
        assertThat(RequestContextHolder.getOptional()).isEmpty();
        assertThat(CurrentUser.getUserId()).isNull();
        assertThat(CurrentUser.getUserIdAsUuid()).isNull();
        assertThat(CurrentUser.getRole()).isNull();
        assertThat(CurrentUser.isAuthenticated()).isFalse();
        assertThat(CurrentUser.hasRole(UserRole.LEARNER)).isFalse();
        assertThat(OrganizationContext.getOrganizationId()).isNull();
        assertThat(OrganizationContext.hasOrganization()).isFalse();
        assertThat(CorrelationContext.getCorrelationId()).isNull();
    }

    @Test
    @DisplayName("Should maintain thread isolation and not leak context between threads")
    void shouldMaintainThreadIsolation() throws InterruptedException {
        String mainUserId = UUID.randomUUID().toString();
        RequestContext mainContext = RequestContext.builder()
                .userId(mainUserId)
                .role(UserRole.ADMIN)
                .build();
        RequestContextHolder.set(mainContext);

        AtomicReference<String> threadUserId = new AtomicReference<>();
        CountDownLatch latch = new CountDownLatch(1);

        Thread backgroundThread = new Thread(() -> {
            // Should be null in another thread initially
            threadUserId.set(CurrentUser.getUserId());
            latch.countDown();
        });

        backgroundThread.start();
        latch.await();

        assertThat(threadUserId.get()).isNull();
        assertThat(CurrentUser.getUserId()).isEqualTo(mainUserId);
    }
}
