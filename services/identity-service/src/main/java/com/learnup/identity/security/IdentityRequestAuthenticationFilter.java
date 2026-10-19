package com.learnup.identity.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.context.HeaderConstants;
import com.learnup.common.context.RequestContext;
import com.learnup.common.context.RequestContextHolder;
import com.learnup.common.response.ApiResponse;
import com.learnup.common.security.UserRole;
import com.learnup.identity.config.JwtConfig;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Identity-only boundary. Raw forwarded identity headers are never principal evidence. */
public final class IdentityRequestAuthenticationFilter extends OncePerRequestFilter {

    public static final String CREDENTIALS_PATH = "/api/internal/credentials";
    private static final Set<String> USER_PATHS = Set.of(
            "/api/v1/auth/me", "/api/auth/me", "/api/v1/users/me", "/api/users/me",
            "/api/v1/auth/logout", "/api/auth/logout",
            "/api/v1/auth/change-password", "/api/auth/change-password");

    private final byte[] internalKey;
    private final JwtParser jwtParser;
    private final ObjectMapper objectMapper;

    public IdentityRequestAuthenticationFilter(String internalKey, JwtConfig jwtConfig, ObjectMapper objectMapper) {
        requireSecureSecret(internalKey, "learnup-internal-secret", "INTERNAL_SERVICE_KEY");
        requireSecureSecret(jwtConfig.getSecret(), "devSecretKeyForLearnUpPlatformMustBeAtLeast32BytesLong", "JWT_SECRET");
        this.internalKey = internalKey.getBytes(StandardCharsets.UTF_8);
        this.jwtParser = Jwts.parser().verifyWith(Keys.hmacShaKeyFor(
                jwtConfig.getSecret().getBytes(StandardCharsets.UTF_8))).build();
        this.objectMapper = objectMapper;
    }

    private static void requireSecureSecret(String secret, String knownDefault, String setting) {
        if (secret == null || secret.isBlank() || secret.getBytes(StandardCharsets.UTF_8).length < 32
                || knownDefault.equals(secret.trim())) {
            throw new IllegalStateException(setting + " must be explicitly configured, non-default and at least 32 bytes");
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        SecurityContextHolder.clearContext();
        RequestContextHolder.clear();
        String correlationId = request.getHeader(HeaderConstants.X_CORRELATION_ID);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }
        response.setHeader(HeaderConstants.X_CORRELATION_ID, correlationId);
        try {
            String path = request.getServletPath();
            // MockMvc and servlet containers without a servletPath use the context-relative URI.
            if (path.isEmpty()) {
                path = request.getRequestURI().substring(request.getContextPath().length());
            }
            boolean credentialsRequest = CREDENTIALS_PATH.equals(path);
            if (credentialsRequest || USER_PATHS.contains(path)) {
                if (!hasInternalKey(request)) {
                    writeError(response, objectMapper, credentialsRequest ? 403 : 401);
                    return;
                }
                if (credentialsRequest) {
                    authenticate("internal-service", "INTERNAL_SERVICE");
                } else {
                    try {
                        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
                        if (authorization == null || !authorization.startsWith("Bearer ")) {
                            throw new IllegalArgumentException("Missing bearer token");
                        }
                        Claims claims = jwtParser.parseSignedClaims(authorization.substring(7).trim()).getPayload();
                        if (claims.getExpiration() == null) {
                            throw new IllegalArgumentException("Missing token expiration");
                        }
                        String subject = claims.getSubject();
                        String roleClaim = claims.get("role", String.class);
                        if (subject == null || roleClaim == null) {
                            throw new IllegalArgumentException("Missing subject or role");
                        }
                        UUID userId = UUID.fromString(subject);
                        UserRole role = UserRole.valueOf(roleClaim);
                        String organization = claims.get("organizationId", String.class);
                        UUID organizationId = organization == null ? null : UUID.fromString(organization);
                        authenticate(userId, "ROLE_" + role.name());
                        RequestContextHolder.set(RequestContext.builder()
                                .userId(userId.toString()).role(role)
                                .organizationId(organizationId == null ? null : organizationId.toString())
                                .correlationId(correlationId).build());
                    } catch (JwtException | IllegalArgumentException ex) {
                        writeError(response, objectMapper, 401);
                        return;
                    }
                }
            }
            // Public endpoints deliberately receive no user context, regardless of supplied headers.
            chain.doFilter(request, response);
        } finally {
            RequestContextHolder.clear();
            SecurityContextHolder.clearContext();
        }
    }

    private boolean hasInternalKey(HttpServletRequest request) {
        String supplied = request.getHeader(HeaderConstants.X_INTERNAL_KEY);
        return supplied != null && MessageDigest.isEqual(internalKey, supplied.getBytes(StandardCharsets.UTF_8));
    }

    private static void authenticate(Object principal, String authority) {
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(principal, null,
                List.of(new SimpleGrantedAuthority(authority))));
        SecurityContextHolder.setContext(context);
    }

    public static void writeError(HttpServletResponse response, ObjectMapper objectMapper, int status) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), ApiResponse.error(
                status == 403 ? "FORBIDDEN" : "UNAUTHORIZED",
                status == 403 ? "Access denied" : "Authentication required"));
    }
}
