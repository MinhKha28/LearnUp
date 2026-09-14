package com.learnup.identity.service;

import com.learnup.common.security.UserRole;
import com.learnup.identity.config.JwtConfig;
import com.learnup.identity.domain.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenServiceTest {

    private static final String TEST_SECRET = "testSecretKeyForLearnUpPlatformMustBeAtLeast32BytesLong!";
    private JwtTokenService jwtTokenService;
    private SecretKey secretKey;

    @BeforeEach
    void setUp() {
        JwtConfig jwtConfig = new JwtConfig();
        jwtConfig.setSecret(TEST_SECRET);
        jwtConfig.setAccessTokenExpirationMinutes(15);
        jwtConfig.setRefreshTokenExpirationDays(7);

        jwtTokenService = new JwtTokenService(jwtConfig);
        secretKey = Keys.hmacShaKeyFor(TEST_SECRET.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    @DisplayName("Should generate valid JWT containing sub, role, and organizationId matching P4 contract")
    void shouldGenerateValidJwt() {
        UUID userId = UUID.randomUUID();
        UUID orgId = UUID.randomUUID();

        User user = new User();
        user.setId(userId);
        user.setUsername("organizer1");
        user.setEmail("org@learnup.com");
        user.setRole(UserRole.ORGANIZER);
        user.setOrganizationId(orgId);

        String token = jwtTokenService.generateAccessToken(user);
        assertThat(token).isNotBlank();

        // Verify token can be parsed using the same HMAC secret key
        Claims claims = Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        assertThat(claims.getSubject()).isEqualTo(userId.toString());
        assertThat(claims.get("role", String.class)).isEqualTo(UserRole.ORGANIZER.name());
        assertThat(claims.get("organizationId", String.class)).isEqualTo(orgId.toString());
        assertThat(claims.getExpiration()).isAfter(claims.getIssuedAt());
    }

    @Test
    @DisplayName("Should omit organizationId claim when user has no organization (e.g. platform ADMIN)")
    void shouldOmitOrganizationIdWhenNull() {
        UUID userId = UUID.randomUUID();

        User user = new User();
        user.setId(userId);
        user.setUsername("admin1");
        user.setEmail("admin@learnup.com");
        user.setRole(UserRole.ADMIN);
        user.setOrganizationId(null);

        String token = jwtTokenService.generateAccessToken(user);

        Claims claims = Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        assertThat(claims.getSubject()).isEqualTo(userId.toString());
        assertThat(claims.get("role", String.class)).isEqualTo(UserRole.ADMIN.name());
        assertThat(claims.get("organizationId")).isNull();
    }
}
