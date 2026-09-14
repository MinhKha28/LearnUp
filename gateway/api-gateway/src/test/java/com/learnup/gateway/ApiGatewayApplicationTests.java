package com.learnup.gateway;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "eureka.client.enabled=false",
        "spring.cloud.discovery.enabled=false"
})
class ApiGatewayApplicationTests {

    @Test
    @DisplayName("Should successfully load API Gateway application context")
    void contextLoads() {
        // Context loads cleanly
    }
}
