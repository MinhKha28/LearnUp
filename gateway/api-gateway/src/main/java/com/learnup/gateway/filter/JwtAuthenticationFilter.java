package com.learnup.gateway.filter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.HeaderConstants;
import com.learnup.common.response.ApiResponse;
import com.learnup.common.security.UserRole;
import com.learnup.gateway.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Global API Gateway filter responsible for:
 * 1. Generating or propagating X-Correlation-ID.
 * 2. Whitelisting public endpoints.
 * 3. Validating JWT access tokens (signature, expiration, claims).
 * 4. Stripping client-spoofed identity headers.
 * 5. Injecting verified identity context downstream (X-User-ID, X-Organization-ID, X-User-Role, X-Correlation-ID).
 */
@Component
public class JwtAuthenticationFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtProperties jwtProperties;
    private final ObjectMapper objectMapper;

    public JwtAuthenticationFilter(JwtProperties jwtProperties, ObjectMapper objectMapper) {
        this.jwtProperties = jwtProperties;
        this.objectMapper = objectMapper;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        // 1. Resolve or generate Correlation ID
        String incomingCorrelationId = request.getHeaders().getFirst(HeaderConstants.X_CORRELATION_ID);
        String correlationId = (incomingCorrelationId != null && !incomingCorrelationId.isBlank())
                ? incomingCorrelationId.trim()
                : UUID.randomUUID().toString();

        // Echo correlation ID back on all responses
        exchange.getResponse().getHeaders().set(HeaderConstants.X_CORRELATION_ID, correlationId);

        // 2. Handle Public Whitelisted Routes
        if (jwtProperties.isWhitelisted(path)) {
            log.debug("Public whitelisted route accessed: {}", path);
            ServerHttpRequest sanitizedRequest = request.mutate()
                    .headers(headers -> {
                        // Strip any spoofed user identity and internal headers from client
                        headers.remove(HeaderConstants.X_INTERNAL_KEY);
                        headers.remove(HeaderConstants.X_USER_ID);
                        headers.remove(HeaderConstants.X_ORGANIZATION_ID);
                        headers.remove(HeaderConstants.X_USER_ROLE);
                        headers.set(HeaderConstants.X_CORRELATION_ID, correlationId);
                        // Inject internal key to allow downstream services to verify gateway origin
                        headers.set(HeaderConstants.X_INTERNAL_KEY, jwtProperties.getInternalKey());
                    })
                    .build();
            return chain.filter(exchange.mutate().request(sanitizedRequest).build());
        }

        // 3. Extract Authorization Header
        String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            log.warn("Missing or malformed Authorization header on protected path: {}", path);
            return writeErrorResponse(exchange, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Missing or malformed Authorization header");
        }

        String token = authHeader.substring(BEARER_PREFIX.length()).trim();
        if (token.isEmpty()) {
            log.warn("Empty Bearer token provided on path: {}", path);
            return writeErrorResponse(exchange, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Empty Bearer token");
        }

        // 4. Validate JWT and Extract Claims
        Claims claims;
        try {
            SecretKey key = Keys.hmacShaKeyFor(jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8));
            claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException e) {
            log.warn("Expired JWT token received for path: {}", path);
            return writeErrorResponse(exchange, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "JWT token has expired");
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Invalid JWT token signature or format on path: {}. Error: {}", path, e.getMessage());
            return writeErrorResponse(exchange, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid JWT token signature or claims");
        }

        // 5. Validate Required Claims
        String userId = claims.getSubject();
        if (userId == null || userId.isBlank()) {
            log.warn("JWT token missing 'sub' claim");
            return writeErrorResponse(exchange, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "JWT missing 'sub' claim");
        }

        String roleStr = claims.get("role", String.class);
        if (roleStr == null || !UserRole.isValid(roleStr)) {
            log.warn("JWT contains invalid or unapproved role claim: '{}'", roleStr);
            return writeErrorResponse(exchange, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid user role claim in JWT");
        }
        UserRole role = UserRole.fromHeader(roleStr);

        String organizationId = claims.get("organizationId", String.class);

        // 6. Sanitize Inbound Headers and Inject Verified Claims
        ServerHttpRequest mutatedRequest = request.mutate()
                .headers(headers -> {
                    // Strip all spoofable headers from client
                    headers.remove(HeaderConstants.X_INTERNAL_KEY);
                    headers.remove(HeaderConstants.X_USER_ID);
                    headers.remove(HeaderConstants.X_ORGANIZATION_ID);
                    headers.remove(HeaderConstants.X_USER_ROLE);
                    headers.remove(HeaderConstants.X_CORRELATION_ID);

                    // Inject verified identity headers and internal key
                    headers.set(HeaderConstants.X_INTERNAL_KEY, jwtProperties.getInternalKey());
                    headers.set(HeaderConstants.X_USER_ID, userId.trim());
                    headers.set(HeaderConstants.X_USER_ROLE, role.name());
                    headers.set(HeaderConstants.X_CORRELATION_ID, correlationId);

                    if (organizationId != null && !organizationId.isBlank()) {
                        headers.set(HeaderConstants.X_ORGANIZATION_ID, organizationId.trim());
                    }
                })
                .build();

        log.debug("Routing authenticated user [{}] with role [{}] and org [{}] to [{}]",
                userId, role, organizationId, path);

        return chain.filter(exchange.mutate().request(mutatedRequest).build());
    }

    private Mono<Void> writeErrorResponse(ServerWebExchange exchange, HttpStatus status, String code, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        ApiResponse<Void> apiResponse = ApiResponse.error(code, message);
        try {
            byte[] bytes = objectMapper.writeValueAsBytes(apiResponse);
            DataBuffer buffer = response.bufferFactory().wrap(bytes);
            return response.writeWith(Mono.just(buffer));
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize gateway error response", e);
            return response.setComplete();
        }
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 10;
    }
}
