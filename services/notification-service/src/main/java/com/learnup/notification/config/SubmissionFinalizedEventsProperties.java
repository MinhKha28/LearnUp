package com.learnup.notification.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.UUID;
import java.util.Locale;

@Configuration
@ConfigurationProperties(prefix = "learnup.submission-finalized")
public class SubmissionFinalizedEventsProperties {
    private boolean enabled;
    private String topic = "learnup.assessment.submission-finalized";
    private String groupId = "notification-submission-finalized-v1";
    private int retryAttempts = 10;
    private long retryInitialMs = 1000;
    private long retryMaxMs = 30000;
    private long startRetryMs = 10000;
    private int dltPartitions = 3;
    private short dltReplicas = 1;
    @Value("${learnup.frontend-base-url:}")
    private String frontendBaseUrl = "";

    @PostConstruct
    public void validate() {
        if (!enabled) return;
        if (topic == null || topic.isBlank() || groupId == null || groupId.isBlank()
                || retryAttempts < 1 || retryInitialMs < 1 || retryMaxMs < retryInitialMs
                || startRetryMs < 1 || dltPartitions < 1 || dltReplicas < 1) {
            throw new IllegalArgumentException("INVALID_SUBMISSION_FINALIZED_CONFIG");
        }
        baseUri();
    }

    private URI baseUri() {
        try {
            URI uri = URI.create(frontendBaseUrl);
            if (!uri.isAbsolute() || !("http".equalsIgnoreCase(uri.getScheme())
                    || "https".equalsIgnoreCase(uri.getScheme())) || uri.getHost() == null
                    || uri.getUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null) {
                throw new IllegalArgumentException();
            }
            return uri;
        } catch (RuntimeException failure) {
            throw new IllegalArgumentException("INVALID_FRONTEND_BASE_URL");
        }
    }

    public static String resultPath(UUID courseId) {
        return UriComponentsBuilder.fromPath("/learner/courses/by-course")
                .pathSegment(courseId.toString(), "results").build().toUriString();
    }

    public String resultUrl(UUID courseId) {
        URI base = baseUri();
        String path = base.getRawPath().replaceAll("/+$", "");
        return UriComponentsBuilder.fromUri(base).scheme(base.getScheme().toLowerCase(Locale.ROOT)).replacePath(path)
                .path(resultPath(courseId)).build(true).toUriString();
    }

    public String getDlt() { return topic + ".DLT"; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }
    public String getGroupId() { return groupId; }
    public void setGroupId(String groupId) { this.groupId = groupId; }
    public int getRetryAttempts() { return retryAttempts; }
    public void setRetryAttempts(int retryAttempts) { this.retryAttempts = retryAttempts; }
    public long getRetryInitialMs() { return retryInitialMs; }
    public void setRetryInitialMs(long retryInitialMs) { this.retryInitialMs = retryInitialMs; }
    public long getRetryMaxMs() { return retryMaxMs; }
    public void setRetryMaxMs(long retryMaxMs) { this.retryMaxMs = retryMaxMs; }
    public long getStartRetryMs() { return startRetryMs; }
    public void setStartRetryMs(long startRetryMs) { this.startRetryMs = startRetryMs; }
    public int getDltPartitions() { return dltPartitions; }
    public void setDltPartitions(int dltPartitions) { this.dltPartitions = dltPartitions; }
    public short getDltReplicas() { return dltReplicas; }
    public void setDltReplicas(short dltReplicas) { this.dltReplicas = dltReplicas; }
    public void setFrontendBaseUrl(String frontendBaseUrl) { this.frontendBaseUrl = frontendBaseUrl; }
}
