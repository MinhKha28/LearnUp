package com.learnup.identity.config;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Operator-configured recovery destinations; request Host/forwarded headers are never used. */
@Configuration
@ConfigurationProperties(prefix = "learnup.recovery")
public class PasswordRecoveryProperties implements InitializingBean {

    private String notificationBaseUrl;
    private String frontendBaseUrl;
    private int connectTimeoutMillis = 2000;
    private int readTimeoutMillis = 5000;
    private int maxRequestsPerWindow = 3;
    private int windowMinutes = 15;
    private int workerThreads = 2;
    private int queueCapacity = 100;

    @Override
    public void afterPropertiesSet() {
        URI notification = requireBaseUrl(notificationBaseUrl, "notification-base-url");
        if (!isPrivateNotificationHost(notification.getHost())) {
            throw new IllegalStateException("learnup.recovery.notification-base-url must use a private service destination");
        }
        URI frontend = requireBaseUrl(frontendBaseUrl, "frontend-base-url");
        if (!"https".equalsIgnoreCase(frontend.getScheme()) && !isLoopback(frontend.getHost())) {
            throw new IllegalStateException("learnup.recovery.frontend-base-url requires HTTPS except on loopback");
        }
        requireRange(connectTimeoutMillis, 100, 10000, "connect-timeout-millis");
        requireRange(readTimeoutMillis, 100, 15000, "read-timeout-millis");
        requireRange(maxRequestsPerWindow, 1, 20, "max-requests-per-window");
        requireRange(windowMinutes, 1, 60, "window-minutes");
        requireRange(workerThreads, 1, 8, "worker-threads");
        requireRange(queueCapacity, 1, 1000, "queue-capacity");
    }

    public String recoveryUrl(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("Recovery token is required");
        }
        String base = frontendBaseUrl.replaceFirst("/+$", "");
        String encoded = URLEncoder.encode(rawToken, StandardCharsets.UTF_8).replace("+", "%20");
        return base + "/reset-password/" + encoded;
    }

    private static URI requireBaseUrl(String value, String setting) {
        String error = "learnup.recovery." + setting + " must be an explicit HTTP(S) base URL without credentials, query or fragment";
        if (value == null || value.isBlank() || !value.equals(value.trim()) || value.contains("\\")) {
            throw new IllegalStateException(error);
        }
        URI uri;
        try {
            uri = URI.create(value);
        } catch (IllegalArgumentException invalid) {
            // URI parser exception messages can contain the complete untrusted setting.
            throw new IllegalStateException(error);
        }
        if ((!"https".equalsIgnoreCase(uri.getScheme()) && !"http".equalsIgnoreCase(uri.getScheme()))
                || uri.getHost() == null || uri.getRawUserInfo() != null || uri.getRawQuery() != null
                || uri.getRawFragment() != null || (uri.getPort() != -1 && (uri.getPort() < 1 || uri.getPort() > 65535))) {
            throw new IllegalStateException(error);
        }
        return uri;
    }

    private static boolean isPrivateNotificationHost(String value) {
        String host = normalizeHost(value);
        if (isLoopback(host) || host.endsWith(".internal") || host.endsWith(".svc")
                || host.endsWith(".svc.cluster.local") || host.endsWith(".local")) {
            return true;
        }
        if (!host.contains(".") && !host.contains(":")) {
            // Compose/Kubernetes single-label service names, not a caller-provided URL.
            return host.matches("[a-z][a-z0-9-]*");
        }
        if (host.contains(":")) {
            return host.matches("(?:fc|fd)[0-9a-f]{2}:[0-9a-f:]+")
                    || host.matches("fe[89ab][0-9a-f]:[0-9a-f:]+");
        }
        String[] octets = host.split("\\.");
        if (octets.length != 4) {
            return false;
        }
        int[] address = new int[4];
        for (int index = 0; index < octets.length; index++) {
            if (!octets[index].matches("0|[1-9][0-9]{0,2}")) {
                return false;
            }
            address[index] = Integer.parseInt(octets[index]);
            if (address[index] > 255) {
                return false;
            }
        }
        return address[0] == 10 || (address[0] == 172 && address[1] >= 16 && address[1] <= 31)
                || (address[0] == 192 && address[1] == 168);
    }

    private static boolean isLoopback(String value) {
        String host = normalizeHost(value);
        return "localhost".equals(host) || "127.0.0.1".equals(host) || "::1".equals(host)
                || "0:0:0:0:0:0:0:1".equals(host);
    }

    private static String normalizeHost(String value) {
        return value.toLowerCase(Locale.ROOT).replace("[", "").replace("]", "");
    }

    private static void requireRange(int value, int minimum, int maximum, String setting) {
        if (value < minimum || value > maximum) {
            throw new IllegalStateException("learnup.recovery." + setting + " is outside its supported range");
        }
    }

    public String getNotificationBaseUrl() { return notificationBaseUrl; }
    public void setNotificationBaseUrl(String notificationBaseUrl) { this.notificationBaseUrl = notificationBaseUrl; }
    public String getFrontendBaseUrl() { return frontendBaseUrl; }
    public void setFrontendBaseUrl(String frontendBaseUrl) { this.frontendBaseUrl = frontendBaseUrl; }
    public int getConnectTimeoutMillis() { return connectTimeoutMillis; }
    public void setConnectTimeoutMillis(int connectTimeoutMillis) { this.connectTimeoutMillis = connectTimeoutMillis; }
    public int getReadTimeoutMillis() { return readTimeoutMillis; }
    public void setReadTimeoutMillis(int readTimeoutMillis) { this.readTimeoutMillis = readTimeoutMillis; }
    public int getMaxRequestsPerWindow() { return maxRequestsPerWindow; }
    public void setMaxRequestsPerWindow(int maxRequestsPerWindow) { this.maxRequestsPerWindow = maxRequestsPerWindow; }
    public int getWindowMinutes() { return windowMinutes; }
    public void setWindowMinutes(int windowMinutes) { this.windowMinutes = windowMinutes; }
    public int getWorkerThreads() { return workerThreads; }
    public void setWorkerThreads(int workerThreads) { this.workerThreads = workerThreads; }
    public int getQueueCapacity() { return queueCapacity; }
    public void setQueueCapacity(int queueCapacity) { this.queueCapacity = queueCapacity; }
}
