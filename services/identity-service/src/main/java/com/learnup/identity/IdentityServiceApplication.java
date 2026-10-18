package com.learnup.identity;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * LearnUP Identity Service application entry point.
 * Manages user accounts, authentication, JWT tokens, and refresh tokens.
 */
// Identity authenticates with its credential service/JWT boundary, not Boot's generated user/password.
@SpringBootApplication(scanBasePackages = {"com.learnup.identity", "com.learnup.common"},
        exclude = UserDetailsServiceAutoConfiguration.class)
@EnableDiscoveryClient
public class IdentityServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(IdentityServiceApplication.class, args);
    }
}
