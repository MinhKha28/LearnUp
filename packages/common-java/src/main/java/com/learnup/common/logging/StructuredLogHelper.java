package com.learnup.common.logging;

import org.slf4j.MDC;

import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Helper utility for structured JSON logging with MDC context management.
 */
public final class StructuredLogHelper {

    public static final String MDC_CORRELATION_ID = "correlationId";
    public static final String MDC_ORGANIZATION_ID = "organizationId";
    public static final String MDC_USER_ID = "userId";
    public static final String MDC_SERVICE_NAME = "service";

    private StructuredLogHelper() {
        // Prevent instantiation
    }

    /**
     * Sets correlationId in MDC.
     */
    public static void setCorrelationId(String correlationId) {
        if (correlationId != null) {
            MDC.put(MDC_CORRELATION_ID, correlationId);
        } else {
            MDC.remove(MDC_CORRELATION_ID);
        }
    }

    /**
     * Sets organizationId in MDC.
     */
    public static void setOrganizationId(String organizationId) {
        if (organizationId != null) {
            MDC.put(MDC_ORGANIZATION_ID, organizationId);
        } else {
            MDC.remove(MDC_ORGANIZATION_ID);
        }
    }

    /**
     * Sets userId in MDC.
     */
    public static void setUserId(String userId) {
        if (userId != null) {
            MDC.put(MDC_USER_ID, userId);
        } else {
            MDC.remove(MDC_USER_ID);
        }
    }

    /**
     * Sets service name in MDC.
     */
    public static void setServiceName(String serviceName) {
        if (serviceName != null) {
            MDC.put(MDC_SERVICE_NAME, serviceName);
        } else {
            MDC.remove(MDC_SERVICE_NAME);
        }
    }

    /**
     * Clears all LearnUP standard keys from MDC.
     */
    public static void clear() {
        MDC.remove(MDC_CORRELATION_ID);
        MDC.remove(MDC_ORGANIZATION_ID);
        MDC.remove(MDC_USER_ID);
        MDC.remove(MDC_SERVICE_NAME);
    }

    /**
     * Executes a supplier with specified MDC context, restoring previous context upon exit.
     */
    public static <T> T withContext(String organizationId, String userId, String correlationId, Supplier<T> supplier) {
        Objects.requireNonNull(supplier, "Supplier must not be null");
        Map<String, String> previousContext = MDC.getCopyOfContextMap();
        try {
            setOrganizationId(organizationId);
            setUserId(userId);
            setCorrelationId(correlationId);
            return supplier.get();
        } finally {
            if (previousContext != null) {
                MDC.setContextMap(previousContext);
            } else {
                clear();
            }
        }
    }

    /**
     * Executes a runnable with specified MDC context, restoring previous context upon exit.
     */
    public static void withContext(String organizationId, String userId, String correlationId, Runnable runnable) {
        Objects.requireNonNull(runnable, "Runnable must not be null");
        withContext(organizationId, userId, correlationId, () -> {
            runnable.run();
            return null;
        });
    }
}
