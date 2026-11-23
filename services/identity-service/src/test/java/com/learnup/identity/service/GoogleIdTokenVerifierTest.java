package com.learnup.identity.service;

import com.learnup.identity.config.GoogleSignInProperties;
import com.learnup.identity.exception.GoogleSignInException;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.PlainJWT;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** UC05.1 verification follows Google's documented checks: signature, iss, aud, exp, verified email. */
class GoogleIdTokenVerifierTest {

    private static final String CLIENT_ID = "1234567890-test.apps.googleusercontent.com";
    private static KeyPair googleKey;
    private static KeyPair otherKey;

    @BeforeAll
    static void keys() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        googleKey = generator.generateKeyPair();
        otherKey = generator.generateKeyPair();
    }

    private static GoogleSignInProperties properties(String clientId) {
        GoogleSignInProperties properties = new GoogleSignInProperties();
        properties.setClientId(clientId);
        properties.afterPropertiesSet();
        return properties;
    }

    private static GoogleIdTokenVerifier verifier() {
        return new GoogleIdTokenVerifier(properties(CLIENT_ID),
                NimbusJwtDecoder.withPublicKey((RSAPublicKey) googleKey.getPublic()).build());
    }

    private static String token(KeyPair key, Consumer<JWTClaimsSet.Builder> customize) throws JOSEException {
        Instant now = Instant.now();
        JWTClaimsSet.Builder claims = new JWTClaimsSet.Builder()
                .issuer("https://accounts.google.com")
                .audience(CLIENT_ID)
                .subject("110169484474386276334")
                .issueTime(Date.from(now.minusSeconds(10)))
                .expirationTime(Date.from(now.plusSeconds(3600)))
                .claim("email", "Learner.One@Example.com")
                .claim("email_verified", true);
        customize.accept(claims);
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("k1").build(), claims.build());
        jwt.sign(new RSASSASigner(key.getPrivate()));
        return jwt.serialize();
    }

    private static void assertInvalid(String credential) {
        assertThatThrownBy(() -> verifier().verify(credential))
                .isInstanceOfSatisfying(GoogleSignInException.class,
                        ex -> assertThat(ex.getCode()).isEqualTo(GoogleSignInException.CREDENTIAL_INVALID));
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://accounts.google.com", "accounts.google.com"})
    @DisplayName("Accepts a correctly signed token from either documented Google issuer and normalises the email")
    void acceptsValidToken(String issuer) throws Exception {
        GoogleIdTokenVerifier.VerifiedGoogleIdentity identity = verifier().verify(token(googleKey, c -> c.issuer(issuer)));
        assertThat(identity.subject()).isEqualTo("110169484474386276334");
        assertThat(identity.email()).isEqualTo("learner.one@example.com");
    }

    @Test
    void acceptsStringEmailVerifiedClaim() throws Exception {
        assertThat(verifier().verify(token(googleKey, c -> c.claim("email_verified", "true"))).email())
                .isEqualTo("learner.one@example.com");
    }

    @Test
    void rejectsForeignIssuer() throws Exception {
        assertInvalid(token(googleKey, c -> c.issuer("https://evil.example.com")));
    }

    @Test
    void rejectsTokenIssuedForAnotherClient() throws Exception {
        assertInvalid(token(googleKey, c -> c.audience("other-app.apps.googleusercontent.com")));
    }

    @Test
    void rejectsExpiredToken() throws Exception {
        assertInvalid(token(googleKey, c -> c.expirationTime(Date.from(Instant.now().minusSeconds(600)))
                .issueTime(Date.from(Instant.now().minusSeconds(4200)))));
    }

    @Test
    void rejectsTokenNotSignedByGoogle() throws Exception {
        assertInvalid(token(otherKey, c -> { }));
    }

    @Test
    void rejectsHmacAndUnsignedTokens() throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder().issuer("https://accounts.google.com").audience(CLIENT_ID)
                .subject("1").expirationTime(Date.from(Instant.now().plusSeconds(600)))
                .claim("email", "a@example.com").claim("email_verified", true).build();
        SignedJWT hmac = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        hmac.sign(new MACSigner("a-shared-secret-that-is-long-enough-for-hs256!!".getBytes()));
        assertInvalid(hmac.serialize());
        assertInvalid(new PlainJWT(claims).serialize());
    }

    @Test
    void rejectsUnverifiedOrMissingEmail() throws Exception {
        assertInvalid(token(googleKey, c -> c.claim("email_verified", false)));
        assertInvalid(token(googleKey, c -> c.claim("email_verified", null)));
        assertInvalid(token(googleKey, c -> c.claim("email", null)));
        assertInvalid(token(googleKey, c -> c.subject(null)));
    }

    @Test
    void rejectsBlankGarbageAndOversizedCredentials() {
        assertInvalid(null);
        assertInvalid("  ");
        assertInvalid("not-a-jwt");
        assertInvalid("a".repeat(4097));
    }

    @Test
    @DisplayName("Without a configured client ID Google sign-in is unavailable, never silently accepted")
    void disabledWithoutClientId() throws Exception {
        GoogleIdTokenVerifier disabled = new GoogleIdTokenVerifier(properties(""));
        assertThat(disabled.isEnabled()).isFalse();
        String credential = token(googleKey, c -> { });
        assertThatThrownBy(() -> disabled.verify(credential))
                .isInstanceOfSatisfying(GoogleSignInException.class,
                        ex -> assertThat(ex.getCode()).isEqualTo(GoogleSignInException.UNAVAILABLE));
    }

    @Test
    @DisplayName("An unreachable Google key set is reported as unavailable, not as a bad credential")
    void unreachableKeySetIsUnavailable() throws Exception {
        GoogleSignInProperties properties = properties(CLIENT_ID);
        properties.setJwkSetUri("https://127.0.0.1:9/oauth2/v3/certs");
        GoogleIdTokenVerifier unreachable = new GoogleIdTokenVerifier(properties);
        String credential = token(googleKey, c -> { });
        assertThatThrownBy(() -> unreachable.verify(credential))
                .isInstanceOfSatisfying(GoogleSignInException.class,
                        ex -> assertThat(ex.getCode()).isEqualTo(GoogleSignInException.UNAVAILABLE));
    }

    @Test
    void rejectsMisconfiguredSettings() {
        assertThatThrownBy(() -> properties("not-a-google-client")).isInstanceOf(IllegalStateException.class);
        GoogleSignInProperties insecure = new GoogleSignInProperties();
        insecure.setClientId(CLIENT_ID);
        insecure.setJwkSetUri("http://www.googleapis.com/oauth2/v3/certs");
        assertThatThrownBy(insecure::afterPropertiesSet).isInstanceOf(IllegalStateException.class);
    }
}
