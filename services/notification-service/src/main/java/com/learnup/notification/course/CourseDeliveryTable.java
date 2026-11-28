package com.learnup.notification.course;

/**
 * The Course delivery ledgers. SQL takes table names only from these constants, never from event data.
 */
public enum CourseDeliveryTable {
    SUBMISSION("course_submission_deliveries", "COURSE_DELIVERY_CLAIMED"),
    OWNERSHIP("course_ownership_deliveries", "OWNERSHIP_DELIVERY_CLAIMED");

    private final String tableName;
    private final String claimedCode;

    CourseDeliveryTable(String tableName, String claimedCode) {
        this.tableName = tableName;
        this.claimedCode = claimedCode;
    }

    String tableName() {
        return tableName;
    }

    String claimedCode() {
        return claimedCode;
    }
}
