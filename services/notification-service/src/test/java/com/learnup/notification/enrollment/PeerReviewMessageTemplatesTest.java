package com.learnup.notification.enrollment;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The words of the notice about the reviews handed out (Vietnamese, with the time of the Organization). */
class PeerReviewMessageTemplatesTest {

    private static final UUID ASSESSMENT = UUID.fromString("b2ab8537-2234-4407-93ff-aff997ff4da9");
    private static final UUID CYCLE = UUID.fromString("8eb38a24-7b2d-4598-a477-cb31f0ef2a84");

    private final PeerReviewMessageTemplates templates = new PeerReviewMessageTemplates();

    private static PeerReviewAssignedEvent event(String title, int count, Instant due) {
        return new PeerReviewAssignedEvent(UUID.randomUUID(), Instant.parse("2026-11-07T03:00:00Z"), UUID.randomUUID(),
                UUID.randomUUID(), ASSESSMENT, CYCLE, title, count, due);
    }

    @Test
    void saysHowManyForWhichAssignmentAndByWhenInVietnamese() {
        EnrollmentMessage message = templates.render(event("Bài tập an toàn", 3, Instant.parse("2026-11-10T10:30:00Z")),
                "Nguyễn Văn An", ZoneId.of("Asia/Ho_Chi_Minh"));

        assertThat(message.title()).isEqualTo("Bạn có bài cần chấm chéo");
        assertThat(message.text()).isEqualTo(
                "Bạn có 3 bài nộp cần chấm cho bài tập «Bài tập an toàn». Vui lòng hoàn thành trước 10/11/2026 17:30.");
        assertThat(message.emailSubject()).isEqualTo(message.title());
        assertThat(message.type()).isEqualTo("PEER_REVIEW");
    }

    @Test
    void writesTheDeadlineOnTheWallOfTheOrganizationAndCrossesMidnightWithItsDay() {
        PeerReviewAssignedEvent due = event("A", 1, Instant.parse("2026-11-10T17:00:00Z"));
        assertThat(templates.render(due, null, ZoneId.of("Asia/Ho_Chi_Minh")).text()).contains("11/11/2026 00:00");
        assertThat(templates.render(due, null, ZoneId.of("UTC")).text()).contains("10/11/2026 17:00");
    }

    @Test
    void neverShowsARawIsoTime() {
        EnrollmentMessage message = templates.render(event("A", 1, Instant.parse("2026-11-10T17:00:00Z")), "An",
                ZoneId.of("Asia/Ho_Chi_Minh"));
        assertThat(message.text()).doesNotMatch(".*\\d{4}-\\d{2}-\\d{2}T.*");
        assertThat(message.emailHtml()).doesNotMatch(".*\\d{4}-\\d{2}-\\d{2}T.*");
    }

    @Test
    void escapesWhatAPersonTypedInTheEmailAndNotInTheText() {
        EnrollmentMessage message = templates.render(event("<b>Bài</b> & \"thử\"", 1, Instant.parse("2026-11-10T17:00:00Z")),
                "<script>x</script>", ZoneId.of("UTC"));

        assertThat(message.emailHtml()).doesNotContain("<script>").doesNotContain("<b>")
                .contains("&lt;script&gt;x&lt;/script&gt;").contains("&lt;b&gt;Bài&lt;/b&gt; &amp; &quot;thử&quot;");
        // the screen shows the text as text, so the title stays as it was written
        assertThat(message.text()).contains("<b>Bài</b> & \"thử\"");
    }

    @Test
    void greetsWithoutANameWhenTheNameIsNotKnown() {
        EnrollmentMessage message = templates.render(event("A", 1, Instant.parse("2026-11-10T17:00:00Z")), " ", ZoneId.of("UTC"));
        assertThat(message.emailHtml()).contains(">Xin chào,</p>").doesNotContain("Xin chào  ").doesNotContain("null");
    }

    @Test
    void linksTheNoticeToTheAssignmentAndTheCycleWithTheKeysTheScreenAlreadyReads() {
        EnrollmentMessage message = templates.render(event("A", 1, Instant.parse("2026-11-10T17:00:00Z")), "An", ZoneId.of("UTC"));
        assertThat(message.metadata()).isEqualTo("{\"assignmentId\":\"" + ASSESSMENT + "\",\"cycleId\":\"" + CYCLE
                + "\",\"event\":\"PeerReviewAssigned\"}");
    }
}
