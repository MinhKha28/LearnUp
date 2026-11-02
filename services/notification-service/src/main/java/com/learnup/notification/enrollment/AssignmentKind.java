package com.learnup.notification.enrollment;

/** Why the Learner was assigned (the {@code kind} that learning-service writes in EnrollmentAssigned). */
public enum AssignmentKind {
    /** A new Enrollment. */
    CREATE(true),
    /** An optional Enrollment became required. */
    CONVERT(true),
    /** An optional Enrollment that was already completed became required: nothing is left to do, so no due date. */
    CONVERT_COMPLETED(false),
    /** A withdrawn Enrollment is back. */
    RESTORE(true);

    private final boolean hasDueDate;

    AssignmentKind(boolean hasDueDate) {
        this.hasDueDate = hasDueDate;
    }

    public boolean hasDueDate() {
        return hasDueDate;
    }
}
