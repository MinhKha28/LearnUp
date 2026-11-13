package com.learnup.identity.controller;

import com.learnup.identity.exception.GoogleSignInException;
import com.learnup.identity.repository.RefreshTokenRepository;
import com.learnup.identity.service.GoogleIdTokenVerifier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Real (unmocked) UC05.1 wiring: without an operator-supplied client ID, Google sign-in is off. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GoogleSignInWiringIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private GoogleIdTokenVerifier verifier;
    @Autowired private RefreshTokenRepository refreshTokenRepository;

    @Test
    void unconfiguredDeploymentReportsGoogleSignInUnavailable() throws Exception {
        assertThat(verifier.isEnabled()).isFalse();
        long sessionsBefore = refreshTokenRepository.count();

        mockMvc.perform(post("/api/v1/auth/google").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"credential\":\"eyJhbGciOiJSUzI1NiJ9.e30.c2ln\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.code").value(GoogleSignInException.UNAVAILABLE))
                .andExpect(jsonPath("$.data").doesNotExist());

        assertThat(refreshTokenRepository.count()).isEqualTo(sessionsBefore);
    }
}
