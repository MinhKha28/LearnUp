package com.learnup.identity.service;

import com.learnup.identity.config.JwtConfig;
import com.learnup.identity.domain.User;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Service
public class JwtTokenService {

    private final JwtConfig jwtConfig;

    public JwtTokenService(JwtConfig jwtConfig) {
        this.jwtConfig = jwtConfig;
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtConfig.getSecret().getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Generate HMAC-SHA256 signed JWT access token containing sub, role, and organizationId claims.
     *
     * @param user the authenticated User entity
     * @return signed JWT string
     */
    public String generateAccessToken(User user) {
        long now = System.currentTimeMillis();
        long expirationMillis = jwtConfig.getAccessTokenExpirationMinutes() * 60 * 1000;

        var builder = Jwts.builder()
                .subject(user.getId().toString())
                .claim("role", user.getRole().name())
                .issuedAt(new Date(now))
                .expiration(new Date(now + expirationMillis))
                .signWith(getSigningKey());

        if (user.getOrganizationId() != null) {
            builder.claim("organizationId", user.getOrganizationId().toString());
        }

        return builder.compact();
    }

    public long getAccessTokenExpirationSeconds() {
        return jwtConfig.getAccessTokenExpirationMinutes() * 60;
    }

    public long getRefreshTokenExpirationDays() {
        return jwtConfig.getRefreshTokenExpirationDays();
    }
}
