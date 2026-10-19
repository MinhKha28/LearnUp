package com.learnup.identity.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.learnup.common.response.ApiResponse;
import io.swagger.v3.core.converter.AnnotatedType;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import io.swagger.v3.oas.models.tags.Tag;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Configuration
@Profile("local-docs & !prod & !production & !docker & !staging")
public class OpenApiConfig {
    public static final String BEARER_SCHEME = "bearerAuth";

    @Bean
    public OpenAPI identityOpenApi(@Value("${learnup.docs.gateway-url}") String gatewayUrl,
                                  @Value("${server.address}") String bindAddress) {
        Set<String> loopbacks = Set.of("127.0.0.1", "localhost", "::1", "[::1]");
        URI gateway = URI.create(gatewayUrl);
        if (!loopbacks.contains(bindAddress) || !loopbacks.contains(gateway.getHost())
                || !Set.of("http", "https").contains(gateway.getScheme()) || gateway.getUserInfo() != null) {
            throw new IllegalStateException("local-docs requires loopback binding and a loopback HTTP(S) Gateway URL");
        }
        return new OpenAPI()
                .info(new Info().title("LearnUP Identity API").version("1.0.0")
                        .description("Credential authentication and session APIs. Use the Gateway for API calls; "
                                + "it supplies the private service credential. Tenant owns account creation and lifecycle. "
                                + "Both v1 and legacy auth aliases are documented. Recovery email delivery remains unimplemented."))
                .servers(List.of(new Server().url(gatewayUrl).description("Local API Gateway")))
                .tags(List.of(new Tag().name("Authentication").description("Password sign-in and credential profile"),
                        new Tag().name("Sessions").description("Refresh rotation and authenticated logout"),
                        new Tag().name("Passwords").description("Password change and recovery token operations")))
                .components(new Components().addSecuritySchemes(BEARER_SCHEME,
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")));
    }

    @Bean
    public OpenApiCustomizer identityResponses() {
        return api -> {
            var error = ModelConverters.getInstance().resolveAsResolvedSchema(new AnnotatedType(
                    new TypeReference<ApiResponse<Void>>() {}.getType()).resolveAsRef(true));
            error.referencedSchemas.forEach(api.getComponents()::addSchemas);
            Map<String, String> descriptions = Map.of(
                    "400", "Invalid request or password/reset-token validation failure",
                    "401", "Invalid credentials/token or missing trusted authenticated request",
                    "403", "Account, Organization or Subscription access denied",
                    "404", "Credential profile not found", "429", "Sign-in temporarily throttled",
                    "503", "Tenant access decision unavailable", "500", "Unexpected server error");
            api.getPaths().forEach((path, item) -> item.readOperations().forEach(operation -> {
                String action = path.substring(path.lastIndexOf('/') + 1);
                List<String> codes = switch (action) {
                    case "login" -> List.of("400", "401", "403", "429", "503", "500");
                    case "refresh" -> List.of("400", "401", "403", "503", "500");
                    case "forgot-password" -> List.of("400", "500");
                    case "reset-password" -> List.of("400", "503", "500");
                    case "change-password" -> List.of("400", "401", "500");
                    case "me" -> List.of("401", "404", "500");
                    default -> List.of("401", "500");
                };
                ApiResponses responses = operation.getResponses();
                codes.forEach(code -> responses.addApiResponse(code, new io.swagger.v3.oas.models.responses.ApiResponse()
                        .description(descriptions.get(code)).content(new Content().addMediaType("application/json",
                                new MediaType().schema(error.schema)))));
            }));
        };
    }
}
