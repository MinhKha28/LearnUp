package com.learnup.identity.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.identity.client.TenantAccessClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "local-docs"})
class OpenApiDocumentationTest {
    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private TenantAccessClient tenantAccessClient;

    @Test
    void shouldDescribeActualAuthenticationContractsWithoutInternalApiOrSecrets() throws Exception {
        String json = mockMvc.perform(get("/v3/api-docs")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode spec = objectMapper.readTree(json);
        assertThat(spec.path("info").path("title").asText()).isEqualTo("LearnUP Identity API");
        assertThat(spec.path("servers").get(0).path("url").asText()).isEqualTo("http://localhost:8088");
        assertThat(spec.path("components").path("securitySchemes").path("bearerAuth").path("scheme").asText()).isEqualTo("bearer");
        assertThat(spec.path("security").isMissingNode()).isTrue();
        assertThat(spec.path("paths").size()).isEqualTo(14);
        for (String prefix : new String[] {"/api/v1/auth", "/api/auth"}) {
            for (String action : new String[] {"login", "refresh", "forgot-password", "reset-password"}) {
                JsonNode operation = spec.path("paths").path(prefix + "/" + action).path("post");
                assertThat(operation.isMissingNode()).isFalse();
                assertThat(operation.path("security").size()).isZero();
                assertThat(operation.path("requestBody").isMissingNode()).isFalse();
                assertThat(operation.path("responses").has("200")).isTrue();
                assertThat(operation.path("responses").has("400")).isTrue();
            }
            for (String action : new String[] {"me", "logout", "change-password"}) {
                JsonNode operation = spec.path("paths").path(prefix + "/" + action).path(action.equals("me") ? "get" : "post");
                assertThat(operation.path("security").get(0).has("bearerAuth")).isTrue();
                assertThat(operation.path("responses").has("401")).isTrue();
                assertThat(operation.path("parameters").size()).isZero(); // No raw identity/internal headers or principal parameter.
            }
            assertThat(spec.path("paths").has(prefix + "/register")).isFalse();
            assertThat(spec.path("paths").path(prefix + "/login").path("post").path("responses").has("429")).isTrue();
        }
        JsonNode password = spec.path("components").path("schemas").path("LoginRequest").path("properties").path("password");
        assertThat(password.path("writeOnly").asBoolean()).isTrue();
        assertThat(password.has("example")).isFalse();
        assertThat(json).doesNotContain("/api/internal/", "SetCredentialsRequest", "X-Internal-Key", "passwordHash",
                "testInternalServiceKeyAtLeast32BytesLong!", "testSecretKeyForLearnUpPlatformMustBeAtLeast32BytesLong!");
    }

    @Test
    void shouldServeUiOnlyInTheOptInModeWithoutRelaxingUserAuthentication() throws Exception {
        mockMvc.perform(get("/swagger-ui.html")).andExpect(status().is3xxRedirection());
        mockMvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
    }
}
