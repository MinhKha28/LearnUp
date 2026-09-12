package com.learnup.gateway.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

/**
 * Gateway filter that validates client JWT tokens, strips any client-supplied spoofed headers,
 * extracts verified claims, and injects authenticated X-User-ID and X-Organization-ID headers.
 */
@Slf4j
@Component
public class AuthenticationHeaderFilter extends AbstractGatewayFilterFactory<AuthenticationHeaderFilter.Config> {

    public static final String HEADER_USER_ID = "X-User-ID";
    public static final String HEADER_ORGANIZATION_ID = "X-Organization-ID";
    public static final String HEADER_USER_ROLE = "X-User-Role";
    public static final String BEARER_PREFIX = "Bearer ";

    private final SecretKey signingKey;

    public AuthenticationHeaderFilter(@Value("${jwt.secret:learnup_super_secret_jwt_signing_key_2026_enterprise_platform_token}") String secret) {
        super(Config.class);
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            ServerHttpRequest request = exchange.getRequest();

            // 1. Check Authorization header
            String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
            if (!StringUtils.hasText(authHeader) || !authHeader.startsWith(BEARER_PREFIX)) {
                log.warn("Missing or invalid Authorization header for path: {}", request.getURI().getPath());
                exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                return exchange.getResponse().setComplete();
            }

            String token = authHeader.substring(BEARER_PREFIX.length()).trim();

            try {
                // 2. Validate JWT signature and parse claims
                Claims claims = Jwts.parser()
                        .verifyWith(this.signingKey)
                        .build()
                        .parseSignedClaims(token)
                        .getPayload();

                String userId = claims.getSubject();
                String organizationId = claims.get("organizationId", String.class);
                String role = claims.get("role", String.class);

                if (!StringUtils.hasText(userId) || !StringUtils.hasText(organizationId)) {
                    log.error("JWT token missing mandatory claims (sub or organizationId)");
                    exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                    return exchange.getResponse().setComplete();
                }

                // 3. Mutate request: MUST overwrite/remove client-supplied headers to prevent spoofing
                ServerHttpRequest mutatedRequest = request.mutate()
                        // Remove any potential spoofed headers from client
                        .headers(httpHeaders -> {
                            httpHeaders.remove(HEADER_USER_ID);
                            httpHeaders.remove(HEADER_ORGANIZATION_ID);
                            httpHeaders.remove(HEADER_USER_ROLE);
                        })
                        // Inject trusted values derived strictly from verified JWT
                        .header(HEADER_USER_ID, userId)
                        .header(HEADER_ORGANIZATION_ID, organizationId)
                        .header(HEADER_USER_ROLE, role != null ? role : "")
                        .build();

                return chain.filter(exchange.mutate().request(mutatedRequest).build());

            } catch (Exception ex) {
                log.warn("JWT token verification failed: {}", ex.getMessage());
                exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                return exchange.getResponse().setComplete();
            }
        };
    }

    public static class Config {
        // Filter configuration properties if needed in future
    }
}
