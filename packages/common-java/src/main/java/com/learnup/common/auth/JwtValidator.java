package com.learnup.common.auth;

import com.learnup.common.constant.RoleConstants;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Reusable helper utility for validating LearnUP JWT tokens and their claims integrity.
 */
public class JwtValidator {

    private static final Logger log = LoggerFactory.getLogger(JwtValidator.class);

    private final JwtParser jwtParser;

    public JwtValidator(String secret) {
        this.jwtParser = new JwtParser(secret);
    }

    public JwtValidator(JwtParser jwtParser) {
        this.jwtParser = jwtParser;
    }

    /**
     * Validates whether a token is structurally sound, properly signed, unexpired,
     * and contains all required claims (sub, organizationId, valid role).
     *
     * @param token The token string to validate
     * @return true if token is fully valid, false otherwise
     */
    public boolean isValid(String token) {
        if (token == null || token.trim().isEmpty()) {
            return false;
        }
        try {
            Claims claims = this.jwtParser.parseClaims(token);
            return hasRequiredClaims(claims);
        } catch (ExpiredJwtException ex) {
            log.debug("JWT token is expired: {}", ex.getMessage());
            return false;
        } catch (JwtException | IllegalArgumentException ex) {
            log.debug("JWT token validation failed: {}", ex.getMessage());
            return false;
        }
    }

    /**
     * Checks if a token has expired.
     */
    public boolean isExpired(String token) {
        try {
            this.jwtParser.parseClaims(token);
            return false;
        } catch (ExpiredJwtException ex) {
            return true;
        } catch (Exception ex) {
            return false;
        }
    }

    /**
     * Validates that the parsed claims contain non-empty sub, organizationId, and a valid platform role.
     */
    public boolean hasRequiredClaims(Claims claims) {
        if (claims == null) {
            return false;
        }
        String subject = claims.getSubject();
        String organizationId = claims.get("organizationId", String.class);
        String role = claims.get("role", String.class);

        boolean hasSubject = subject != null && !subject.trim().isEmpty();
        boolean hasOrgId = organizationId != null && !organizationId.trim().isEmpty();
        boolean hasValidRole = RoleConstants.isValidRole(role);

        return hasSubject && hasOrgId && hasValidRole;
    }
}
