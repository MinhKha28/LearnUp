package com.learnup.eureka;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class EurekaServerApplicationTests {

    @Test
    @DisplayName("Should successfully load Eureka server application context in standalone mode")
    void contextLoads() {
        // Application context successfully initializes
    }
}
