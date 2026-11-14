package com.learnup.notification.mail;

import com.learnup.notification.mail.EmailLayout.Card;
import com.learnup.notification.mail.EmailLayout.Tone;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EmailLayoutTest {

    private static final String EVIL = "<script>alert(1)</script> & \"q\" 'a'";

    @Test
    void isOneCardWithTheLogoTheHeadingAndAFooter() {
        String html = EmailLayout.render(Card.of("Tiêu đề").paragraph("Nội dung"));
        assertThat(html).startsWith("<!DOCTYPE html>").contains("lang=\"vi\"").contains("charset=\"UTF-8\"")
                .contains("<img src=\"cid:learnup-logo\" alt=\"LearnUP\"")
                .contains("<h1 style=\"margin:14px 0 8px;font-size:22px;line-height:1.3\">Tiêu đề</h1>")
                .contains(">Nội dung</p>")
                .contains("vui lòng không trả lời thư này")
                .endsWith("</table></body></html>");
        assertThat(html).doesNotContain("null");
    }

    @Test
    void theBadgeTakesTheColorOfItsTone() {
        String success = EmailLayout.render(Card.of("A").badge("ĐÃ PHÊ DUYỆT", Tone.SUCCESS));
        String danger = EmailLayout.render(Card.of("A").badge("BỊ TỪ CHỐI", Tone.DANGER));
        assertThat(success).contains(">ĐÃ PHÊ DUYỆT</span>").contains("color:#15803d").contains("background:#f0fdf4");
        assertThat(danger).contains(">BỊ TỪ CHỐI</span>").contains("color:#b91c1c").contains("background:#fef2f2");
        assertThat(EmailLayout.render(Card.of("A"))).doesNotContain("border-radius:999px");
    }

    @Test
    void greetsByNameOrWithoutOneOrNotAtAll() {
        assertThat(EmailLayout.render(Card.of("A").greeting("  Minh  "))).contains(">Xin chào Minh,</p>");
        assertThat(EmailLayout.render(Card.of("A").greeting(null))).contains(">Xin chào,</p>");
        assertThat(EmailLayout.render(Card.of("A").greeting(" "))).contains(">Xin chào,</p>");
        assertThat(EmailLayout.render(Card.of("A"))).doesNotContain("Xin chào");
    }

    @Test
    void nothingAPersonTypedCanBecomeHtml() {
        String html = EmailLayout.render(Card.of(EVIL).badge(EVIL, Tone.INFO).greeting(EVIL).paragraph(EVIL)
                .detail(EVIL, EVIL, Tone.WARNING).callout(EVIL, EVIL, Tone.DANGER).closing(EVIL));
        assertThat(html).doesNotContain("<script>").doesNotContain("alert(1)</script>");
        // the heading, the badge, the greeting, the paragraph, the label and value, the box heading and text, the closing
        assertThat(html.split("&lt;script&gt;alert\\(1\\)&lt;/script&gt; &amp; &quot;q&quot; &#39;a&#39;", -1).length - 1)
                .isGreaterThanOrEqualTo(10);
    }

    @Test
    void keepsTheLineBreaksOfAParagraphAsBreaks() {
        String html = EmailLayout.render(Card.of("A").paragraph("một\nhai\r\nba"));
        assertThat(html).contains("một<br/>hai<br/>ba");
    }

    @Test
    void detailsAreRowsOfALabelAndAValue() {
        String html = EmailLayout.render(Card.of("A").detail("Khóa học", "An toàn").detail("Kết quả", "Đã duyệt", Tone.SUCCESS));
        assertThat(html).contains(">Khóa học</td>").contains(">An toàn</td>").contains(">Kết quả</td>")
                .contains("color:#15803d;")
                .contains("border-top:1px solid #e2e8f0");
        assertThat(EmailLayout.render(Card.of("A"))).doesNotContain("width:110px");
    }

    @Test
    void theBoxHasItsHeadingAndItsTextInTheColorOfItsTone() {
        String html = EmailLayout.render(Card.of("A").callout("Lý do từ chối", "Thiếu bài tập", Tone.DANGER));
        assertThat(html).contains("border-left:4px solid #b91c1c").contains(">Lý do từ chối</div>")
                .contains(">Thiếu bài tập</div>");
    }

    @Test
    void aButtonKeepsItsPlaceBetweenTheParagraphs() {
        String html = EmailLayout.render(Card.of("A").paragraph("trước").button("Mở", "https://example.test/a?x=1&y=2")
                .paragraph("sau"));
        assertThat(html.indexOf("trước")).isLessThan(html.indexOf("href="));
        assertThat(html.indexOf("href=")).isLessThan(html.indexOf("sau"));
        assertThat(html).contains("href=\"https://example.test/a?x=1&amp;y=2\"").contains(">Mở</a>");
    }

    @Test
    void aLinkThatIsNotHttpIsNotAButton() {
        for (String url : new String[] { "javascript:alert(1)", "data:text/html,x", "ftp://example.test", "//example.test",
                "https://example.test/a b", "https://example.test/\"onclick=\"x", "https://example.test/<x>", null }) {
            assertThat(EmailLayout.render(Card.of("A").button("Mở", url))).doesNotContain("<a href");
        }
        assertThat(EmailLayout.render(Card.of("A").button("Mở", "http://localhost:3000/x"))).contains("<a href");
    }
}
