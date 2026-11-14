package com.learnup.notification.mail;

import com.learnup.notification.mail.EmailLayout.Card;
import com.learnup.notification.mail.EmailLayout.Tone;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Other services send their e-mails to {@code POST /api/v1/notifications/email/send} as plain text. For the kinds listed
 * here the text is set in the same card as the e-mails of this service: the subject becomes the heading, a first line
 * "Xin chào {name}," the greeting, the paragraphs (blank-line separated) the text, and a line that is only a link a button.
 * A kind that is not listed, and a body that already is HTML, go out as they came.
 */
public final class PlainEmailFraming {

    private record Look(String badge, Tone tone, String buttonLabel) {}

    private static final Map<String, Look> LOOKS = Map.of(
            "ASSIGNMENT_FINALIZED", new Look("Đã có điểm", Tone.SUCCESS, null),
            "PEER_REVIEW_REMINDER", new Look("Sắp đến hạn", Tone.WARNING, null),
            "PEER_REVIEW_WAIVED", new Look("Được miễn", Tone.INFO, null),
            "IDENTITY_PASSWORD_RECOVERY", new Look("Khôi phục mật khẩu", Tone.INFO, "Đặt mật khẩu mới"));

    private static final String GREETING_PREFIX = "Xin chào";

    private PlainEmailFraming() {}

    /** @return the card as HTML, or empty when this body is not to be framed */
    public static Optional<String> frame(String templateCode, String subject, String body) {
        Look look = templateCode == null ? null : LOOKS.get(templateCode);
        if (look == null || body == null || body.isBlank() || body.contains("<") || subject == null) {
            return Optional.empty();
        }
        Card card = Card.of(subject).badge(look.badge(), look.tone());
        String[] paragraphs = body.replace("\r\n", "\n").strip().split("\n\\s*\n");
        int first = 0;
        String head = paragraphs[0].strip();
        if (head.startsWith(GREETING_PREFIX) && head.endsWith(",") && head.indexOf('\n') < 0) {
            card.greeting(head.substring(GREETING_PREFIX.length(), head.length() - 1));
            first = 1;
        }
        boolean linked = false;
        for (int i = first; i < paragraphs.length; i++) {
            List<String> text = new ArrayList<>();
            for (String line : paragraphs[i].split("\n")) {
                String stripped = line.strip();
                if (!linked && isLink(stripped)) {
                    // the text before the link comes first, the button stands where the link stood
                    if (!text.isEmpty()) {
                        card.paragraph(String.join("\n", text));
                        text.clear();
                    }
                    card.button(look.buttonLabel() == null ? "Mở liên kết" : look.buttonLabel(), stripped);
                    linked = true;
                } else if (!stripped.isEmpty()) {
                    text.add(stripped);
                }
            }
            if (!text.isEmpty()) {
                card.paragraph(String.join("\n", text));
            }
        }
        return Optional.of(EmailLayout.render(card));
    }

    private static boolean isLink(String line) {
        return EmailLayout.isSafeUrl(line) && line.indexOf('\n') < 0;
    }
}
