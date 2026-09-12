package com.learnup.common.auth;

import com.learnup.common.api.JwtClaims;
import com.learnup.common.constant.HeaderConstants;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Reusable helper utility for parsing and extracting claims from LearnUP JWT tokens.
 */
public class JwtParser {

    private final SecretKey secretKey;

    public JwtParser(String secret) {
        if (secret == null || secret.trim().length() < 32) {
            throw new IllegalArgumentException("JWT secret key must be at least 32 characters (256 bits) long.");
        }
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Parses and verifies a signed JWT token string, extracting its claims payload.
     *
     * @param token Bearer token or compact JWT string
     * @return Standardized Claims object
     */
    public Claims parseClaims(String token) {
        String cleanToken = sanitizeToken(token);
        return Jwts.parser()
                .verifyWith(this.secretKey)
                .build()
                .parseSignedClaims(cleanToken)
                .getPayload();
    }

    /**
     * Parses a JWT token and maps it into a strongly-typed JwtClaims model.
     *
     * @param token Bearer token or compact JWT string
     * @return JwtClaims strongly-typed object
     */
    public JwtClaims parseJwtClaims(String token) {
        Claims claims = parseClaims(token);
        Date issuedAt = claims.getIssuedAt();
        Date expiration = claims.getExpiration();

        return JwtClaims.builder()
                .sub(claims.getSubject())
                .role(claims.get("role", String.class))
                .organizationId(claims.get("organizationId", String.class))
                .iat(issuedAt != null ? issuedAt.getTime() / 1000 : null)
                .exp(expiration != null ? expiration.getTime() / 1000 : null)
                .iss(claims.getIssuer())
                .aud(claims.getAudience() != null && !claims.getAudience().isEmpty()
                        ? claims.getAudience().iterator().next() : null)
                .build();
    }

    /**
     * Parses a JWT token and converts it directly into a CurrentUser abstraction.
     *
     * @param token Bearer token or compact JWT string
     * @return CurrentUser object
     */
    public CurrentUser parseCurrentUser(String token) {
        Claims claims = parseClaims(token);
        return CurrentUser.builder()
                .userId(claims.getSubject())
                .role(claims.get("role", String.class))
                .organizationId(claims.get("organizationId", String.class))
                .build();
    }

    /**
     * Extracts the organizationId from the JWT token.
     */
    public String extractOrganizationId(String token) {
        Claims claims = parseClaims(token);
        return claims.get("organizationId", String.class);
    }

    /**
     * Extracts the role from the JWT token.
     */
    public String extractRole(String token) {
        Claims claims = parseClaims(token);
        return claims.get("role", String.class);
    }

    /**
     * Extracts the subject (User ID) from the JWT token.
     */
    public String extractUserId(String token) {
        Claims claims = parseClaims(token);
        return claims.getSubject();
    }

    private String sanitizeToken(String token) {
        if (token == null || token.trim().isEmpty()) {
            throw new IllegalArgumentException("JWT token string cannot be null or blank.");
        }
        String trimmed = token.trim();
        if (trimmed.startsWith(HeaderConstants.BEARER_PREFIX)) {
            return trimmed.substring(HeaderConstants.BEARER_PREFIX.length()).trim();
        }
        return trimmed;
    }
}
