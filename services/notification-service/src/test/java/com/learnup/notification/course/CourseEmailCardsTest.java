package com.learnup.notification.course;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The e-mails about Courses are set in the same card as the others: logo, badge, details, footer. */
class CourseEmailCardsTest {
    private static final String NAME = "An toàn <lao động> & \"PCCC\"";
    private static final String ESCAPED = "An toàn &lt;lao động&gt; &amp; &quot;PCCC&quot;";

    private static UUID id() {
        return UUID.randomUUID();
    }

    @Test
    void theEmailToTheOrganizerSaysACourseAwaitsApproval() {
        String html = CourseSubmittedEventHandler.emailHtml(
                new CourseSubmittedEvent(id(), id(), id(), id(), NAME, 3, Instant.now(), Instant.now()));
        assertThat(html).startsWith("<!DOCTYPE html>").contains("cid:learnup-logo")
                .contains(">Chờ phê duyệt</span>").contains(">Khóa học đang chờ phê duyệt</h1>")
                .contains("Giảng viên đã gửi một khóa học để bạn xem xét và phê duyệt.")
                .contains(">Khóa học</td>").contains(">Phiên bản</td>").contains(">3</td>")
                .contains(">Chờ phê duyệt</td>").contains("Khóa học chưa được công bố")
                .contains(ESCAPED)
                .doesNotContain("<lao").doesNotContain("Course").doesNotContain("null");
        // no name is known for the Organizer here, so the greeting has none
        assertThat(html).contains(">Xin chào,</p>");
    }

    @Test
    void theEmailToTheNewOwnerSaysTheCourseWasTransferred() {
        String html = CourseOwnershipTransferredEventHandler.emailHtml(new CourseOwnershipTransferredEvent(
                id(), id(), id(), id(), id(), id(), id(), NAME, null, Instant.now()));
        assertThat(html).startsWith("<!DOCTYPE html>").contains("cid:learnup-logo")
                .contains(">Phụ trách khóa học</span>").contains(">Chuyển quyền phụ trách khóa học</h1>")
                .contains("Bạn đã được chuyển quyền phụ trách khóa học «" + ESCAPED + "».")
                .contains("Việc chuyển quyền áp dụng cho toàn bộ phiên bản khóa học.")
                .contains(">Khóa học</td>").contains(ESCAPED)
                .doesNotContain("<lao").doesNotContain("null");
    }
}
