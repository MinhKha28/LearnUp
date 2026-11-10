package com.learnup.identity.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.learnup.common.security.UserRole;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class UserResponseContractTest {
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Test
    void shouldPreserveConstructorAndPublicJsonShape() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID organizationId = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-01-01T00:00:00Z");
        var response = new UserResponse(userId, "member", "member@example.invalid", "Member",
                UserRole.LEARNER, organizationId, true, createdAt);
        var json = objectMapper.readTree(objectMapper.writeValueAsString(response));

        assertThat(json.size()).isEqualTo(8);
        assertThat(json.path("id").asText()).isEqualTo(userId.toString());
        assertThat(json.path("username").asText()).isEqualTo("member");
        assertThat(json.path("email").asText()).isEqualTo("member@example.invalid");
        assertThat(json.path("fullName").asText()).isEqualTo("Member");
        assertThat(json.path("role").asText()).isEqualTo("LEARNER");
        assertThat(json.path("organizationId").asText()).isEqualTo(organizationId.toString());
        assertThat(json.path("enabled").asBoolean()).isTrue();
        assertThat(json.path("createdAt").asText()).isEqualTo(createdAt.toString());
        assertThat(json.has("passwordHash")).isFalse();
        assertThat(json.has("refreshToken")).isFalse();
        assertThat(json.has("resetToken")).isFalse();
    }

    @Test
    void shouldPreserveNoArgSettersBooleanAccessorAndNullOrganization() throws Exception {
        var response = new UserResponse();
        response.setId(UUID.randomUUID());
        response.setUsername("admin");
        response.setEmail("admin@example.invalid");
        response.setFullName(null);
        response.setRole(UserRole.ADMIN);
        response.setOrganizationId(null);
        response.setEnabled(false);
        response.setCreatedAt(null);

        UserResponse roundTrip = objectMapper.readValue(objectMapper.writeValueAsString(response), UserResponse.class);
        assertThat(roundTrip.getId()).isEqualTo(response.getId());
        assertThat(roundTrip.getUsername()).isEqualTo("admin");
        assertThat(roundTrip.getEmail()).isEqualTo(response.getEmail());
        assertThat(roundTrip.getRole()).isEqualTo(UserRole.ADMIN);
        assertThat(roundTrip.getFullName()).isNull();
        assertThat(roundTrip.getOrganizationId()).isNull();
        assertThat(roundTrip.getCreatedAt()).isNull();
        assertThat(roundTrip.isEnabled()).isFalse();
    }
}
