package com.learnup.identity.security;

import com.learnup.common.constant.RoleConstants;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Platform JWT token generator and validator.
 * Standardizes token claims strictly on: sub, role (ADMIN, ORGANIZER, INSTRUCTOR, LEARNER), organizationId.
 */
@Component
public class JwtTokenProvider {

    private final SecretKey signingKey;
    private final long expirationMs;
    private final String issuer;
    private final String audience;

    public JwtTokenProvider(
            @Value("${jwt.secret:learnup_super_secret_jwt_signing_key_2026_enterprise_platform_token}") String secret,
            @Value("${jwt.expiration-ms:3600000}") long expirationMs,
            @Value("${jwt.issuer:learnup-identity-service}") String issuer,
            @Value("${jwt.audience:learnup-platform}") String audience) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
        this.issuer = issuer;
        this.audience = audience;
    }

    /**
     * Generates a signed JWT token adhering to platform standards.
     *
     * @param userId         The subject identifier (sub)
     * @param organizationId Standardized tenant identifier
     * @param role           Canonical role (ADMIN, ORGANIZER, INSTRUCTOR, LEARNER)
     * @return Serialized compact JWT
     */
    public String generateToken(String userId, String organizationId, String role) {
        if (!RoleConstants.isValidRole(role)) {
            throw new IllegalArgumentException("Invalid platform role: " + role + ". Allowed roles: " + RoleConstants.ALLOWED_ROLES);
        }

        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(userId)
                .claim("organizationId", organizationId)
                .claim("role", role.toUpperCase())
                .issuer(issuer)
                .audience().add(audience).and()
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(signingKey)
                .compact();
    }

    /**
     * Parses and validates a JWT token, extracting its claims payload.
     */
    public Claims parseAndValidateToken(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
