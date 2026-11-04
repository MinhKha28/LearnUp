package com.learnup.notification.enrollment;

import java.util.Arrays;
import java.util.Optional;

/** The events of the learning enrollment topic that this service acts on. The others on the topic are ignored. */
public enum EnrollmentEventType {
    ASSIGNED("EnrollmentAssigned"),
    DUE_DATE_EXTENDED("EnrollmentDueDateExtended"),
    EXEMPTED("EnrollmentExempted"),
    WITHDREW("LearnerWithdrew");

    private final String wireName;

    EnrollmentEventType(String wireName) {
        this.wireName = wireName;
    }

    public String wireName() {
        return wireName;
    }

    public static Optional<EnrollmentEventType> fromWireName(String name) {
        return Arrays.stream(values()).filter(type -> type.wireName.equals(name)).findFirst();
    }
}
