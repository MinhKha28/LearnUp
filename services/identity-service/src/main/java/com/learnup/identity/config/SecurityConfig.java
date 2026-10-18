package com.learnup.identity.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.exception.GlobalExceptionHandler;
import com.learnup.identity.security.IdentityRequestAuthenticationFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.http.HttpMethod;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

@Configuration
@EnableWebSecurity
@Import(GlobalExceptionHandler.class)
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper objectMapper, JwtConfig jwtConfig,
            @Value("${security.internal-key}") String internalKey, Environment environment) throws Exception {
        // Not a servlet Filter bean: register once, only within Spring Security's chain.
        var authenticationFilter = new IdentityRequestAuthenticationFilter(internalKey, jwtConfig, objectMapper);
        http
                .csrf(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> {
                    if (environment.acceptsProfiles(Profiles.of("local-docs & !prod & !docker & !staging"))) {
                        auth.requestMatchers(HttpMethod.GET, "/v3/api-docs", "/v3/api-docs.yaml", "/v3/api-docs/**",
                                "/swagger-ui.html", "/swagger-ui/**").permitAll();
                    }
                    auth.requestMatchers(HttpMethod.POST,
                                "/api/v1/auth/login", "/api/auth/login",
                                "/api/v1/auth/refresh", "/api/auth/refresh",
                                "/api/v1/auth/forgot-password", "/api/auth/forgot-password",
                                "/api/v1/auth/reset-password", "/api/auth/reset-password"
                        ).permitAll()
                        .requestMatchers(HttpMethod.GET, "/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers(HttpMethod.POST, IdentityRequestAuthenticationFilter.CREDENTIALS_PATH)
                            .hasAuthority("INTERNAL_SERVICE")
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/logout", "/api/auth/logout",
                                "/api/v1/auth/change-password", "/api/auth/change-password").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/auth/me", "/api/auth/me",
                                "/api/v1/users/me", "/api/users/me").authenticated()
                        .anyRequest().denyAll();
                })
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, ex) ->
                                IdentityRequestAuthenticationFilter.writeError(response, objectMapper, 401))
                        .accessDeniedHandler((request, response, ex) ->
                                IdentityRequestAuthenticationFilter.writeError(response, objectMapper, 403)))
                .addFilterBefore(authenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
