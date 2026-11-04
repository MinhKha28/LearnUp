package com.learnup.notification.config;

import com.learnup.common.context.HeaderConstants;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/** The HTTP clients of the services that the consumer asks: both carry the internal key and a short timeout. */
@Configuration
public class EnrollmentEventClientsConfig {

    @Bean
    public RestClient tenantRestClient(@Value("${tenant.service-url}") String baseUrl,
                                       @Value("${security.internal-key}") String internalKey,
                                       @Value("${learnup.enrollment-events.client-timeout-ms:3000}") long timeoutMs) {
        return build(baseUrl, internalKey, Duration.ofMillis(timeoutMs));
    }

    @Bean
    public RestClient courseRestClient(@Value("${course.service-url}") String baseUrl,
                                       @Value("${security.internal-key}") String internalKey,
                                       @Value("${learnup.enrollment-events.client-timeout-ms:3000}") long timeoutMs) {
        return build(baseUrl, internalKey, Duration.ofMillis(timeoutMs));
    }

    private static RestClient build(String baseUrl, String internalKey, Duration timeout) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(timeout);
        requestFactory.setReadTimeout(timeout);
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .defaultHeader(HeaderConstants.X_INTERNAL_KEY, internalKey)
                .build();
    }
}
