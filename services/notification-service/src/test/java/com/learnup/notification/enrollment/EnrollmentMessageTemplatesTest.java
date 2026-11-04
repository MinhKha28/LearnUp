package com.learnup.notification.enrollment;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class EnrollmentMessageTemplatesTest {

    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final UUID ENROLLMENT = UUID.fromString("8eb38a24-7b2d-4598-a477-cb31f0ef2a84");
    private static final UUID COURSE = UUID.fromString("b2ab8537-2234-4407-93ff-aff997ff4da9");
    // 2026-12-01 00:00 in Ho Chi Minh is 2026-11-30 17:00 UTC
    private static final Instant DUE = Instant.parse("2026-11-30T17:00:00Z");

    private final EnrollmentMessageTemplates templates = new EnrollmentMessageTemplates();

    private static EnrollmentEvent assigned(AssignmentKind kind, Instant dueAt) {
        return new EnrollmentEvent(UUID.randomUUID(), EnrollmentEventType.ASSIGNED, Instant.parse("2026-10-27T01:00:00Z"),
                UUID.randomUUID(), ENROLLMENT, UUID.randomUUID(), COURSE, kind, dueAt, null, null, null);
    }

    private static EnrollmentEvent extended(Instant previous, Instant next, String reason) {
        return new EnrollmentEvent(UUID.randomUUID(), EnrollmentEventType.DUE_DATE_EXTENDED,
                Instant.parse("2026-10-27T01:00:00Z"), UUID.randomUUID(), ENROLLMENT, UUID.randomUUID(), COURSE, null, null,
                previous, next, reason);
    }

    private static EnrollmentEvent exempted(String reason) {
        return new EnrollmentEvent(UUID.randomUUID(), EnrollmentEventType.EXEMPTED, Instant.parse("2026-10-27T01:00:00Z"),
                UUID.randomUUID(), ENROLLMENT, UUID.randomUUID(), COURSE, null, null, null, null, reason);
    }

    private static EnrollmentEvent withdrew() {
        return new EnrollmentEvent(UUID.randomUUID(), EnrollmentEventType.WITHDREW, Instant.parse("2026-10-27T01:00:00Z"),
                UUID.randomUUID(), ENROLLMENT, UUID.randomUUID(), COURSE, null, null, null, null, null);
    }

    @Test
    void aNewAssignmentNamesTheCourseAndTheDueDateInTheOrganizationTimeZone() {
        EnrollmentMessage message = templates.render(assigned(AssignmentKind.CREATE, DUE), "An toàn lao động",
                "Nguyễn Văn An", VN).orElseThrow();

        assertThat(message.title()).isEqualTo("Bạn được giao một khóa học");
        assertThat(message.text()).isEqualTo("Bạn được giao khóa học «An toàn lao động». Hạn hoàn thành: hết ngày 30/11/2026.");
        assertThat(message.type()).isEqualTo("ENROLLMENT_ASSIGNED");
    }

    @Test
    void aDueDateIsTheEndOfTheDayTheOrganizerChoseNotMidnightOfTheNextOne() {
        // learning stores the end of 30/11 as 00:00 of 01/12 (BR-167); the Learner reads 30/11
        EnrollmentMessage message = templates.render(assigned(AssignmentKind.CREATE, DUE), "X", "A", VN).orElseThrow();
        assertThat(message.text()).contains("hết ngày 30/11/2026").doesNotContain("01/12/2026").doesNotContain("24:00");
    }

    @Test
    void aTimeThatIsNotMidnightIsWrittenWithTheHour() {
        EnrollmentMessage message = templates.render(assigned(AssignmentKind.CREATE, Instant.parse("2026-12-01T03:30:00Z")),
                "X", "A", VN).orElseThrow();
        assertThat(message.text()).contains("Hạn hoàn thành: 01/12/2026 10:30.");
    }

    @Test
    void theEndOfAMonthAndOfAYearRollBackCorrectly() {
        // 00:00 on 01/01/2027 in Ho Chi Minh is the end of 31/12/2026
        EnrollmentMessage message = templates.render(assigned(AssignmentKind.CREATE, Instant.parse("2026-12-31T17:00:00Z")),
                "X", "A", VN).orElseThrow();
        assertThat(message.text()).contains("hết ngày 31/12/2026");
    }

    @Test
    void theSameInstantIsAnotherDayInAnotherTimeZone() {
        EnrollmentMessage message = templates.render(assigned(AssignmentKind.CREATE, DUE), "X", "A", ZoneId.of("UTC"))
                .orElseThrow();
        assertThat(message.text()).contains("30/11/2026 17:00");
    }

    @Test
    void everyKindThatHasADueDateWritesIt() {
        for (AssignmentKind kind : new AssignmentKind[]{AssignmentKind.CREATE, AssignmentKind.CONVERT, AssignmentKind.RESTORE}) {
            EnrollmentMessage message = templates.render(assigned(kind, DUE), "X", "A", VN).orElseThrow();
            assertThat(message.text()).as(kind.name()).contains("Hạn hoàn thành: hết ngày 30/11/2026");
        }
    }

    @Test
    void theKindsHaveTheirOwnWords() {
        assertThat(templates.render(assigned(AssignmentKind.CONVERT, DUE), "X", "A", VN).orElseThrow().title())
                .isEqualTo("Khóa học đã trở thành bắt buộc");
        assertThat(templates.render(assigned(AssignmentKind.RESTORE, DUE), "X", "A", VN).orElseThrow().title())
                .isEqualTo("Bạn được giao lại một khóa học");
    }

    @Test
    void aConversionOfACompletedEnrollmentWritesNoDueDate() {
        EnrollmentMessage message = templates.render(assigned(AssignmentKind.CONVERT_COMPLETED, null), "An toàn lao động",
                "A", VN).orElseThrow();
        assertThat(message.text()).doesNotContain("Hạn hoàn thành");
        assertThat(message.text()).contains("đã hoàn thành").contains("không cần làm thêm");
        assertThat(message.type()).isEqualTo("ENROLLMENT_ASSIGNED");
    }

    @Test
    void anExtensionWritesTheNewDateThePreviousOneAndTheReason() {
        EnrollmentMessage message = templates.render(
                extended(Instant.parse("2026-11-30T17:00:00Z"), Instant.parse("2026-12-07T17:00:00Z"), "Bận công tác"),
                "An toàn lao động", "A", VN).orElseThrow();
        assertThat(message.title()).isEqualTo("Hạn hoàn thành đã được gia hạn");
        assertThat(message.text()).isEqualTo(
                "Hạn hoàn thành khóa học «An toàn lao động» được gia hạn đến hết ngày 07/12/2026 (trước đó: hết ngày 30/11/2026). Lý do: Bận công tác.");
        assertThat(message.type()).isEqualTo("ENROLLMENT_DUE_DATE_EXTENDED");
    }

    @Test
    void anExtensionWithoutAPreviousDateOrAReasonLeavesThemOut() {
        EnrollmentMessage message = templates.render(extended(null, DUE, null), "X", "A", VN).orElseThrow();
        assertThat(message.text()).isEqualTo("Hạn hoàn thành khóa học «X» được gia hạn đến hết ngày 30/11/2026.");
    }

    @Test
    void anExemptionTellsTheLearnerAndGivesTheReason() {
        EnrollmentMessage message = templates.render(exempted("Đã có chứng chỉ tương đương"), "An toàn lao động", "A", VN)
                .orElseThrow();
        assertThat(message.title()).isEqualTo("Bạn được miễn khóa học");
        assertThat(message.text()).isEqualTo("Bạn được miễn khóa học «An toàn lao động». Lý do: Đã có chứng chỉ tương đương.");
        assertThat(message.type()).isEqualTo("ENROLLMENT_EXEMPTED");
        assertThat(templates.render(exempted(null), "X", "A", VN).orElseThrow().text()).doesNotContain("Lý do");
    }

    @Test
    void aWithdrawalWritesToNobody() {
        assertThat(templates.render(withdrew(), "X", "A", VN)).isEmpty();
    }

    @Test
    void whenTheCourseIsNotKnownTheMessageStillReads() {
        EnrollmentMessage message = templates.render(assigned(AssignmentKind.CREATE, DUE), null, "A", VN).orElseThrow();
        assertThat(message.text()).isEqualTo("Bạn được giao một khóa học. Hạn hoàn thành: hết ngày 30/11/2026.");
        EnrollmentMessage exemption = templates.render(exempted(null), "  ", "A", VN).orElseThrow();
        assertThat(exemption.text()).isEqualTo("Bạn được miễn một khóa học.");
    }

    @Test
    void theEmailGreetsTheLearnerAndIsHtml() {
        EnrollmentMessage message = templates.render(assigned(AssignmentKind.CREATE, DUE), "An toàn lao động",
                "Nguyễn Văn An", VN).orElseThrow();
        assertThat(message.emailSubject()).isEqualTo("Bạn được giao một khóa học");
        assertThat(message.emailHtml()).startsWith("<p>Xin chào Nguyễn Văn An,</p>");
        assertThat(message.emailHtml()).contains("<p>Bạn được giao khóa học «An toàn lao động». Hạn hoàn thành: hết ngày 30/11/2026.</p>");
    }

    @Test
    void nothingTypedByAPersonCanBecomeHtmlInTheEmail() {
        String evil = "<script>alert(1)</script>&\"'";
        EnrollmentMessage message = templates.render(exempted(evil), evil, evil, VN).orElseThrow();
        assertThat(message.emailHtml()).doesNotContain("<script>");
        assertThat(message.emailHtml()).contains("&lt;script&gt;alert(1)&lt;/script&gt;");
        // the in-app text is plain text and is shown as text, so it keeps what was typed
        assertThat(message.text()).contains(evil);
    }

    @Test
    void theMetadataLinksTheNoticeToTheEnrollmentAndTheCourse() {
        EnrollmentMessage message = templates.render(assigned(AssignmentKind.CREATE, DUE), "X", "A", VN).orElseThrow();
        assertThat(message.metadata()).isEqualTo(
                "{\"enrollmentId\":\"" + ENROLLMENT + "\",\"courseId\":\"" + COURSE + "\",\"event\":\"EnrollmentAssigned\"}");
    }
}
