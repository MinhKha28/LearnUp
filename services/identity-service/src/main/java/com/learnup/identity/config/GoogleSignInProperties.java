package com.learnup.identity.config;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.net.URI;

/**
 * UC05.1 Google sign-in settings. Google sign-in is disabled unless an operator supplies
 * the OAuth web client ID; the client ID is not a secret, but it is never hard-coded.
 */
@Configuration
@ConfigurationProperties(prefix = "learnup.google-sign-in")
public class GoogleSignInProperties implements InitializingBean {

    static final String DEFAULT_JWK_SET_URI = "https://www.googleapis.com/oauth2/v3/certs";

    private String clientId;
    private String jwkSetUri = DEFAULT_JWK_SET_URI;

    @Override
    public void afterPropertiesSet() {
        if (clientId != null && !clientId.isBlank()
                && !clientId.trim().endsWith(".apps.googleusercontent.com")) {
            throw new IllegalStateException("learnup.google-sign-in.client-id must be a Google OAuth web client ID");
        }
        URI jwks = URI.create(jwkSetUri);
        if (!"https".equalsIgnoreCase(jwks.getScheme()) || jwks.getHost() == null) {
            throw new IllegalStateException("learnup.google-sign-in.jwk-set-uri must be an absolute HTTPS URI");
        }
    }

    public boolean isEnabled() {
        return clientId != null && !clientId.isBlank();
    }

    public String getClientId() {
        return clientId == null ? null : clientId.trim();
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public String getJwkSetUri() {
        return jwkSetUri;
    }

    public void setJwkSetUri(String jwkSetUri) {
        this.jwkSetUri = jwkSetUri;
    }
}
