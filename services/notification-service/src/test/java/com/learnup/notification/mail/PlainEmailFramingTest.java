package com.learnup.notification.mail;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PlainEmailFramingTest {

    private static String frame(String code, String subject, String body) {
        return PlainEmailFraming.frame(code, subject, body).orElseThrow();
    }

    @Test
    void theSubjectBecomesTheHeadingAndTheGreetingLineTheGreeting() {
        String html = frame("ASSIGNMENT_FINALIZED", "Điểm bài tập đã được công bố",
                "Xin chào Trần Văn Minh,\n\nGiảng viên đã chốt điểm cho \"Bài 1\". Điểm của bạn là 79,5%.");
        assertThat(html).contains("<h1 style=\"margin:14px 0 8px;font-size:22px;line-height:1.3\">Điểm bài tập đã được công bố</h1>")
                .contains(">Xin chào Trần Văn Minh,</p>").contains("Điểm của bạn là 79,5%.")
                .contains(">Đã có điểm</span>").contains("cid:learnup-logo");
        assertThat(html.indexOf("Xin chào")).isEqualTo(html.lastIndexOf("Xin chào"));
    }

    @Test
    void eachKnownKindHasItsOwnBadge() {
        assertThat(frame("PEER_REVIEW_REMINDER", "S", "Xin chào A,\n\nB")).contains(">Sắp đến hạn</span>");
        assertThat(frame("PEER_REVIEW_WAIVED", "S", "Xin chào A,\n\nB")).contains(">Được miễn</span>");
        assertThat(frame("IDENTITY_PASSWORD_RECOVERY", "S", "Xin chào A,\n\nB")).contains(">Khôi phục mật khẩu</span>");
    }

    @Test
    void paragraphsAreSeparatedByABlankLineAndKeepTheirLineBreaks() {
        String html = frame("PEER_REVIEW_REMINDER", "S", "Xin chào A,\r\n\r\nMột.\r\nHai.\r\n\r\nBa.");
        assertThat(html).contains(">Một.<br/>Hai.</p>").contains(">Ba.</p>");
    }

    @Test
    void aBodyWithoutAGreetingLineStillGetsTheCard() {
        String html = frame("PEER_REVIEW_WAIVED", "S", "Chỉ có nội dung.");
        assertThat(html).contains(">Chỉ có nội dung.</p>").doesNotContain("Xin chào");
    }

    @Test
    void aLineThatIsOnlyALinkBecomesAButtonWhereItStands() {
        String link = "https://frontend.example.test/reset-password?token=abc&x=1";
        String html = frame("IDENTITY_PASSWORD_RECOVERY", "LearnUP - Đặt lại mật khẩu",
                "Hệ thống nhận được yêu cầu đặt lại mật khẩu.\n\nMở liên kết sau để chọn mật khẩu mới:\n" + link
                        + "\n\nLiên kết chỉ dùng được một lần.");
        assertThat(html).contains("href=\"https://frontend.example.test/reset-password?token=abc&amp;x=1\"")
                .contains(">Đặt mật khẩu mới</a>");
        assertThat(html.indexOf("Mở liên kết sau để chọn mật khẩu mới:")).isLessThan(html.indexOf("href="));
        assertThat(html.indexOf("href=")).isLessThan(html.indexOf("Liên kết chỉ dùng được một lần."));
        // the link is a button, not repeated as text
        assertThat(html.split("reset-password", -1).length - 1).isEqualTo(1);
    }

    @Test
    void aLinkInTheMiddleOfASentenceStaysTextAndIsEscaped() {
        String html = frame("PEER_REVIEW_REMINDER", "S", "Xin chào A,\n\nXem https://example.test/a?x=1&y=2 để biết thêm.");
        assertThat(html).doesNotContain("<a href").contains("https://example.test/a?x=1&amp;y=2");
    }

    @Test
    void aLinkThatIsNotHttpIsTextNotAButton() {
        String html = frame("IDENTITY_PASSWORD_RECOVERY", "S", "Xin chào A,\n\njavascript:alert(1)");
        assertThat(html).doesNotContain("<a href").contains("javascript:alert(1)");
    }

    @Test
    void whatIsNotToBeFramedIsLeftAlone() {
        assertThat(PlainEmailFraming.frame("SOME_OTHER_KIND", "S", "Xin chào A,\n\nB")).isEmpty();
        assertThat(PlainEmailFraming.frame(null, "S", "Xin chào A,\n\nB")).isEmpty();
        assertThat(PlainEmailFraming.frame("PEER_REVIEW_REMINDER", "S", "<p>Already HTML</p>")).isEmpty();
        assertThat(PlainEmailFraming.frame("PEER_REVIEW_REMINDER", "S", " ")).isEmpty();
        assertThat(PlainEmailFraming.frame("PEER_REVIEW_REMINDER", "S", null)).isEmpty();
        assertThat(PlainEmailFraming.frame("PEER_REVIEW_REMINDER", null, "Xin chào A,\n\nB")).isEmpty();
    }

    @Test
    void whatAPersonTypedStaysText() {
        // the senders cut the angle brackets themselves; a body that still has them is HTML and is left alone, one that has
        // only the other characters is escaped
        String html = frame("PEER_REVIEW_REMINDER", "Tiêu đề & \"nháy\"", "Xin chào A & B,\n\nDòng \"một\" & 'hai'.");
        assertThat(html).contains("Tiêu đề &amp; &quot;nháy&quot;").contains("Xin chào A &amp; B,")
                .contains("Dòng &quot;một&quot; &amp; &#39;hai&#39;.");
    }
}
