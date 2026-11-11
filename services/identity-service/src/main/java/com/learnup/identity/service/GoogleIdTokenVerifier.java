package com.learnup.identity.service;

import com.learnup.identity.config.GoogleSignInProperties;
import com.learnup.identity.exception.GoogleSignInException;
import com.nimbusds.jose.KeySourceException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Locale;
import java.util.Set;

/**
 * Verifies a Google ID token (UC05.1) as Google documents: RS256 signature against Google's
 * JWKS, {@code iss} is accounts.google.com, {@code aud} is our client ID and {@code exp} has
 * not passed. The account email is only trusted when Google marks it verified.
 */
@Component
public class GoogleIdTokenVerifier {

    static final Set<String> GOOGLE_ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");
    private static final int MAX_CREDENTIAL_LENGTH = 4096;

    private final GoogleSignInProperties properties;
    private volatile JwtDecoder decoder;

    @Autowired
    public GoogleIdTokenVerifier(GoogleSignInProperties properties) {
        this.properties = properties;
    }

    /** Test seam: verify with a caller-supplied signature decoder (validators are still applied). */
    GoogleIdTokenVerifier(GoogleSignInProperties properties, NimbusJwtDecoder decoder) {
        this.properties = properties;
        decoder.setJwtValidator(validator(properties.getClientId()));
        this.decoder = decoder;
    }

    public boolean isEnabled() {
        return properties.isEnabled();
    }

    public VerifiedGoogleIdentity verify(String credential) {
        if (!properties.isEnabled()) {
            throw GoogleSignInException.unavailable(null);
        }
        if (credential == null || credential.isBlank() || credential.length() > MAX_CREDENTIAL_LENGTH) {
            throw GoogleSignInException.invalidCredential(null);
        }
        Jwt jwt;
        try {
            jwt = decoder().decode(credential.trim());
        } catch (JwtException ex) {
            throw isKeySourceFailure(ex) ? GoogleSignInException.unavailable(ex) : GoogleSignInException.invalidCredential(ex);
        }
        String subject = jwt.getSubject();
        String email = jwt.getClaimAsString("email");
        if (subject == null || subject.isBlank() || email == null || email.isBlank() || !isEmailVerified(jwt.getClaim("email_verified"))) {
            throw GoogleSignInException.invalidCredential(null);
        }
        return new VerifiedGoogleIdentity(subject, email.trim().toLowerCase(Locale.ROOT));
    }

    private JwtDecoder decoder() {
        JwtDecoder current = decoder;
        if (current == null) {
            synchronized (this) {
                current = decoder;
                if (current == null) {
                    NimbusJwtDecoder nimbus = NimbusJwtDecoder.withJwkSetUri(properties.getJwkSetUri())
                            .jwsAlgorithm(SignatureAlgorithm.RS256)
                            .build();
                    nimbus.setJwtValidator(validator(properties.getClientId()));
                    decoder = current = nimbus;
                }
            }
        }
        return current;
    }

    static OAuth2TokenValidator<Jwt> validator(String clientId) {
        OAuth2TokenValidator<Jwt> issuer = jwt -> GOOGLE_ISSUERS.contains(jwt.getClaimAsString(JwtClaimNames.ISS))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Unexpected issuer", null));
        OAuth2TokenValidator<Jwt> audience = jwt -> jwt.getAudience() != null && jwt.getAudience().contains(clientId)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Unexpected audience", null));
        return new DelegatingOAuth2TokenValidator<>(new JwtTimestampValidator(), issuer, audience);
    }

    private static boolean isEmailVerified(Object claim) {
        return Boolean.TRUE.equals(claim) || "true".equalsIgnoreCase(String.valueOf(claim));
    }

    private static boolean isKeySourceFailure(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause()) {
            if (t instanceof KeySourceException || t instanceof IOException) {
                return true;
            }
        }
        return false;
    }

    /** Verified Google identity; {@code subject} is Google's stable account ID. */
    public record VerifiedGoogleIdentity(String subject, String email) {
    }
}
