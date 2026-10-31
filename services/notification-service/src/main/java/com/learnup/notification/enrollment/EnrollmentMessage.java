package com.learnup.notification.enrollment;

/**
 * What the Learner is told about one event: the same words as an in-app notice and as an e-mail.
 *
 * @param title        the title of the notice, and the subject of the e-mail
 * @param text         the notice as plain text (the screen shows it as text)
 * @param type         the type of the in-app notice
 * @param emailSubject the subject of the e-mail
 * @param emailHtml    the e-mail; everything a person typed is escaped
 * @param metadata     JSON that links the notice to the Enrollment and the Course
 */
public record EnrollmentMessage(String title, String text, String type, String emailSubject, String emailHtml,
                                String metadata) {
}
