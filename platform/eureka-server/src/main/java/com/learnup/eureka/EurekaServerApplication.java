package com.learnup.eureka;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.server.EnableEurekaServer;

/**
 * LearnUP Central Discovery Server.
 * Runs Netflix Eureka Server for dynamic microservice registration, heartbeat monitoring,
 * and client-side load-balancing topology maintenance.
 *
 * Requirements:
 * - Java 21
 * - Zero business logic
 * - Zero database
 * - Zero JWT authentication
 * - Zero Kafka events
 */
@SpringBootApplication
@EnableEurekaServer
public class EurekaServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(EurekaServerApplication.class, args);
    }
}
