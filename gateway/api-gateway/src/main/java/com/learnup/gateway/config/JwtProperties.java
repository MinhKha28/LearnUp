package com.learnup.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.AntPathMatcher;

import java.util.ArrayList;
import java.util.List;

/**
 * Configuration properties for JWT validation and public route whitelisting.
 */
@Configuration
@ConfigurationProperties(prefix = "jwt")
public class JwtProperties {

    private static final AntPathMatcher PATH_MATCHER = new AntPathMatcher();

    /**
     * Secret key used for verifying HMAC-SHA256 JWT tokens.
     * In production/staging, this must be supplied via the JWT_SECRET environment variable.
     */
    private String secret = "devSecretKeyForLearnUpPlatformMustBeAtLeast32BytesLong";

    /**
     * Shared secret key forwarded downstream in the x-internal-key header.
     */
    private String internalKey = "learnup-internal-secret";

    /**
     * Paths that bypass JWT validation.
     */
    private List<String> whitelist = new ArrayList<>(List.of(
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/refresh",
            "/api/v1/auth/forgot-password",
            "/api/v1/auth/reset-password",
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/refresh",
            "/api/auth/forgot-password",
            "/api/auth/reset-password",
            "/api/v1/certificates/verify/**",
            "/api/certificates/verify/**",
            "/actuator/health",
            "/fallback/**"
    ));

    public String getInternalKey() {
        return internalKey;
    }

    public void setInternalKey(String internalKey) {
        this.internalKey = internalKey;
    }

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public List<String> getWhitelist() {
        return whitelist;
    }

    public void setWhitelist(List<String> whitelist) {
        this.whitelist = whitelist;
    }

    /**
     * Check if a given URI path is whitelisted (publicly accessible without JWT).
     *
     * @param path request URI path
     * @return true if whitelisted, false otherwise
     */
    public boolean isWhitelisted(String path) {
        if (path == null) {
            return false;
        }
        for (String pattern : whitelist) {
            if (PATH_MATCHER.match(pattern, path)) {
                return true;
            }
        }
        return false;
    }
}
