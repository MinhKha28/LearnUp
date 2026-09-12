package com.learnup.common.auth;

import com.learnup.common.constant.RoleConstants;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;

class JwtValidatorTest {

    private static final String SECRET = "learnup_super_secret_jwt_signing_key_2026_enterprise_platform_token";
    private JwtValidator jwtValidator;
    private SecretKey secretKey;

    @BeforeEach
    void setUp() {
        this.jwtValidator = new JwtValidator(SECRET);
        this.secretKey = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
    }

    private String createToken(String userId, String orgId, String role, long durationMs) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + durationMs);

        return Jwts.builder()
                .subject(userId)
                .claim("organizationId", orgId)
                .claim("role", role)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(this.secretKey)
                .compact();
    }

    @Test
    @DisplayName("Should validate valid JWT as true")
    void shouldValidateValidToken() {
        String token = createToken("usr_100", "org_200", RoleConstants.ORGANIZER, 60000);
        assertThat(this.jwtValidator.isValid(token)).isTrue();
        assertThat(this.jwtValidator.isExpired(token)).isFalse();
    }

    @Test
    @DisplayName("Should reject expired JWT")
    void shouldRejectExpiredToken() {
        String token = createToken("usr_100", "org_200", RoleConstants.ORGANIZER, -1000);
        assertThat(this.jwtValidator.isValid(token)).isFalse();
        assertThat(this.jwtValidator.isExpired(token)).isTrue();
    }

    @Test
    @DisplayName("Should reject token with invalid role")
    void shouldRejectInvalidRole() {
        String token = createToken("usr_100", "org_200", "SUPER_USER", 60000);
        assertThat(this.jwtValidator.isValid(token)).isFalse();
    }

    @Test
    @DisplayName("Should reject token missing organizationId claim")
    void shouldRejectMissingOrgId() {
        Date now = new Date();
        String token = Jwts.builder()
                .subject("usr_100")
                .claim("role", RoleConstants.LEARNER)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + 60000))
                .signWith(this.secretKey)
                .compact();

        assertThat(this.jwtValidator.isValid(token)).isFalse();
    }
}
