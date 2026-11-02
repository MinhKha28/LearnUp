package com.learnup.notification.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Settings of the consumer of the learning enrollment events ({@code learnup.enrollment-events.*}).
 */
@Configuration
@ConfigurationProperties(prefix = "learnup.enrollment-events")
public class EnrollmentEventsProperties {

    /** The consumer reads the topic only when this is true; otherwise the service starts without Kafka. */
    private boolean enabled = false;

    private String topic = "learnup.learning.enrollment-events";

    /** An event older than this is recorded as SKIPPED instead of being sent. */
    private Duration maxAge = Duration.ofHours(72);

    /** Tries of one event (the first one included) before it goes to the dead-letter topic. */
    private int retryAttempts = 5;

    private Duration retryInitialBackoff = Duration.ofSeconds(1);

    private Duration retryMaxBackoff = Duration.ofSeconds(30);

    /**
     * How long a handler may hold a delivery (status PROCESSING) before another one may take it over. It must be longer
     * than the slowest handling of one event (the calls to tenant and course, the e-mail) and than the retry pauses.
     */
    private Duration claimLease = Duration.ofMinutes(2);

    /** Pause between two tries to start the consumer while it is not running (see EnrollmentEventListenerStarter). */
    private Duration startRetryInterval = Duration.ofSeconds(10);

    /** Partitions and replicas of the dead-letter topic when this service has to create it. */
    private int deadLetterPartitions = 3;

    private short deadLetterReplicas = 1;

    /** Time zone of the dates in the messages until tenant-service gives the one of the Organization. */
    private String defaultTimeZone = "Asia/Ho_Chi_Minh";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getTopic() {
        return topic;
    }

    public void setTopic(String topic) {
        this.topic = topic;
    }

    /** The dead-letter topic of the events that could not be handled. */
    public String getDeadLetterTopic() {
        return topic + ".DLT";
    }

    public Duration getMaxAge() {
        return maxAge;
    }

    public void setMaxAge(Duration maxAge) {
        this.maxAge = maxAge;
    }

    public int getRetryAttempts() {
        return retryAttempts;
    }

    public void setRetryAttempts(int retryAttempts) {
        this.retryAttempts = retryAttempts;
    }

    public Duration getRetryInitialBackoff() {
        return retryInitialBackoff;
    }

    public void setRetryInitialBackoff(Duration retryInitialBackoff) {
        this.retryInitialBackoff = retryInitialBackoff;
    }

    public Duration getRetryMaxBackoff() {
        return retryMaxBackoff;
    }

    public void setRetryMaxBackoff(Duration retryMaxBackoff) {
        this.retryMaxBackoff = retryMaxBackoff;
    }

    public Duration getStartRetryInterval() {
        return startRetryInterval;
    }

    public void setStartRetryInterval(Duration startRetryInterval) {
        this.startRetryInterval = startRetryInterval;
    }

    public Duration getClaimLease() {
        return claimLease;
    }

    public void setClaimLease(Duration claimLease) {
        this.claimLease = claimLease;
    }

    public int getDeadLetterPartitions() {
        return deadLetterPartitions;
    }

    public void setDeadLetterPartitions(int deadLetterPartitions) {
        this.deadLetterPartitions = deadLetterPartitions;
    }

    public short getDeadLetterReplicas() {
        return deadLetterReplicas;
    }

    public void setDeadLetterReplicas(short deadLetterReplicas) {
        this.deadLetterReplicas = deadLetterReplicas;
    }

    public String getDefaultTimeZone() {
        return defaultTimeZone;
    }

    public void setDefaultTimeZone(String defaultTimeZone) {
        this.defaultTimeZone = defaultTimeZone;
    }
}
