package com.learnup.identity.mapper;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.learnup.common.security.UserRole;
import com.learnup.identity.domain.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringJUnitConfig(UserMapperTest.MapperConfiguration.class)
class UserMapperTest {
    @Configuration
    @ComponentScan(basePackageClasses = UserMapper.class)
    static class MapperConfiguration {}

    @Autowired private UserMapper mapper;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @ParameterizedTest
    @EnumSource(UserRole.class)
    void shouldDiscoverGeneratedSpringBeanAndMapExactlyThePreviousPublicFields(UserRole role) throws Exception {
        assertThat(mapper.getClass().getSimpleName()).isEqualTo("UserMapperImpl");
        User user = new User(UUID.randomUUID(), "member", "member@example.invalid", "synthetic-unusable-hash",
                "Member", role, role == UserRole.ADMIN ? null : UUID.randomUUID(), true,
                Instant.parse("2026-01-01T00:00:00Z"), Instant.parse("2026-01-02T00:00:00Z"));

        var response = mapper.toResponse(user);
        assertThat(response.getId()).isEqualTo(user.getId());
        assertThat(response.getUsername()).isEqualTo(user.getUsername());
        assertThat(response.getEmail()).isEqualTo(user.getEmail());
        assertThat(response.getFullName()).isEqualTo(user.getFullName());
        assertThat(response.getRole()).isEqualTo(role);
        assertThat(response.getOrganizationId()).isEqualTo(user.getOrganizationId());
        assertThat(response.isEnabled()).isTrue();
        assertThat(response.getCreatedAt()).isEqualTo(user.getCreatedAt());
        String json = objectMapper.writeValueAsString(response);
        var tree = objectMapper.readTree(json);
        assertThat(tree.size()).isEqualTo(8);
        assertThat(tree.path("role").asText()).isEqualTo(role.name());
        assertThat(json).doesNotContain("passwordHash", "refreshToken", "resetToken", "synthetic-unusable-hash", "updatedAt");
    }

    @Test
    void shouldReturnNullForNullSourceLikeTheManualMapper() {
        assertThat(mapper.toResponse(null)).isNull();
    }

    @Test
    void shouldPreserveNullFieldsAndDisabledState() {
        var user = new User();
        user.setEnabled(false);
        var response = mapper.toResponse(user);
        assertThat(response.getId()).isNull();
        assertThat(response.getUsername()).isNull();
        assertThat(response.getEmail()).isNull();
        assertThat(response.getFullName()).isNull();
        assertThat(response.getRole()).isNull();
        assertThat(response.getOrganizationId()).isNull();
        assertThat(response.getCreatedAt()).isNull();
        assertThat(response.isEnabled()).isFalse();
    }
}
