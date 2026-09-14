package com.learnup.identity;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * LearnUP Identity Service application entry point.
 * Manages user accounts, authentication, JWT tokens, and refresh tokens.
 */
@SpringBootApplication(scanBasePackages = {"com.learnup.identity", "com.learnup.common"})
@EnableDiscoveryClient
public class IdentityServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(IdentityServiceApplication.class, args);
    }
}
