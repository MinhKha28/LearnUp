package com.learnup.common.auth;

import com.learnup.common.api.JwtClaims;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtParserTest {

    private static final String SECRET = "learnup_super_secret_jwt_signing_key_2026_enterprise_platform_token";
    private JwtParser jwtParser;
    private SecretKey secretKey;

    @BeforeEach
    void setUp() {
        this.jwtParser = new JwtParser(SECRET);
        this.secretKey = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
    }

    private String createTestToken(String userId, String orgId, String role, long durationMs) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + durationMs);

        return Jwts.builder()
                .subject(userId)
                .claim("organizationId", orgId)
                .claim("role", role)
                .issuer("learnup-identity-service")
                .issuedAt(now)
                .expiration(expiry)
                .signWith(this.secretKey)
                .compact();
    }

    @Test
    @DisplayName("Should parse valid JWT and map claims properly")
    void shouldParseValidJwt() {
        String token = createTestToken("usr_100", "org_200", RoleConstants.ORGANIZER, 60000);

        JwtClaims claims = this.jwtParser.parseJwtClaims(token);

        assertThat(claims.getSub()).isEqualTo("usr_100");
        assertThat(claims.getOrganizationId()).isEqualTo("org_200");
        assertThat(claims.getRole()).isEqualTo("ORGANIZER");
        assertThat(claims.getIss()).isEqualTo("learnup-identity-service");
        assertThat(claims.getIat()).isNotNull();
        assertThat(claims.getExp()).isNotNull();
    }

    @Test
    @DisplayName("Should parse Bearer prefixed token string")
    void shouldParseBearerToken() {
        String token = createTestToken("usr_100", "org_200", RoleConstants.LEARNER, 60000);
        String bearerToken = "Bearer " + token;

        CurrentUser user = this.jwtParser.parseCurrentUser(bearerToken);

        assertThat(user.getUserId()).isEqualTo("usr_100");
        assertThat(user.getOrganizationId()).isEqualTo("org_200");
        assertThat(user.getRole()).isEqualTo("LEARNER");
    }

    @Test
    @DisplayName("Should extract individual claims directly")
    void shouldExtractIndividualClaims() {
        String token = createTestToken("usr_100", "org_200", RoleConstants.INSTRUCTOR, 60000);

        assertThat(this.jwtParser.extractUserId(token)).isEqualTo("usr_100");
        assertThat(this.jwtParser.extractOrganizationId(token)).isEqualTo("org_200");
        assertThat(this.jwtParser.extractRole(token)).isEqualTo("INSTRUCTOR");
    }

    @Test
    @DisplayName("Should throw IllegalArgumentException when secret is too short")
    void shouldRejectShortSecret() {
        assertThatThrownBy(() -> new JwtParser("short_secret"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
