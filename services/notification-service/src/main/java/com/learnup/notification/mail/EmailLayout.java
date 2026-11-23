package com.learnup.notification.mail;

import java.util.ArrayList;
import java.util.List;

/**
 * The one look of the e-mails this service writes: a card with the LearnUP logo, a badge, the heading, the greeting, the
 * text, optional details, a marked box and a button, and a footer. Only tables and inline styles are used, so mail clients
 * draw it alike. Every text handed in is plain text and is escaped here, so nothing a person typed can become HTML.
 * The logo is attached to the message by {@code EmailDeliveryService} when the body shows {@code cid:learnup-logo}.
 */
public final class EmailLayout {

    /** The colors of the frontend (styles/global.scss), as tenant-service uses them in its own e-mails. */
    private static final String PRIMARY = "#0f172a";
    private static final String TEXT = "#334155";
    private static final String MUTED = "#64748b";
    private static final String BORDER = "#e2e8f0";
    private static final String PAGE = "#f1f5f9";
    private static final String ACCENT = "#f59e0b";

    /** What kind of news the card brings: the color of the badge and of the marked box. */
    public enum Tone {
        SUCCESS("#15803d", "#f0fdf4"),
        DANGER("#b91c1c", "#fef2f2"),
        WARNING("#b45309", "#fffbeb"),
        INFO("#1d4ed8", "#eff6ff");

        final String accent;
        final String tint;

        Tone(String accent, String tint) {
            this.accent = accent;
            this.tint = tint;
        }
    }

    public record Row(String label, String value, Tone tone) {
        public Row(String label, String value) {
            this(label, value, null);
        }
    }

    public record Callout(String heading, String text, Tone tone) {}

    public record Button(String label, String url) {}

    /** What one e-mail says. Build it with {@link #of(String)} and the {@code with...} methods. */
    public static final class Card {
        private final String heading;
        private String badge;
        private Tone tone = Tone.INFO;
        private boolean greeted;
        private String greetingName;
        /** Paragraphs (String) and buttons (Button), in the order they are written. */
        private final List<Object> blocks = new ArrayList<>();
        private final List<Row> details = new ArrayList<>();
        private Callout callout;
        private String closing;

        private Card(String heading) {
            this.heading = heading;
        }

        public static Card of(String heading) {
            return new Card(heading);
        }

        public Card badge(String text, Tone tone) {
            this.badge = text;
            this.tone = tone;
            return this;
        }

        /** "Xin chào {name}," or, when the name is not known, "Xin chào,". Leave it out for no greeting at all. */
        public Card greeting(String name) {
            this.greeted = true;
            this.greetingName = name;
            return this;
        }

        public Card paragraph(String text) {
            blocks.add(text);
            return this;
        }

        public Card detail(String label, String value) {
            details.add(new Row(label, value));
            return this;
        }

        public Card detail(String label, String value, Tone tone) {
            details.add(new Row(label, value, tone));
            return this;
        }

        public Card callout(String heading, String text, Tone tone) {
            this.callout = new Callout(heading, text, tone);
            return this;
        }

        public Card button(String label, String url) {
            blocks.add(new Button(label, url));
            return this;
        }

        public Card closing(String text) {
            this.closing = text;
            return this;
        }
    }

    private EmailLayout() {}

    public static String render(Card card) {
        StringBuilder html = new StringBuilder(2048);
        html.append("<!DOCTYPE html><html lang=\"vi\"><head><meta charset=\"UTF-8\"/>")
                .append("<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>")
                .append("<title>").append(escape(card.heading)).append("</title></head>")
                .append("<body style=\"margin:0;padding:24px 12px;background:").append(PAGE)
                .append(";font-family:Arial,Helvetica,sans-serif\">")
                .append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" ")
                .append("style=\"max-width:600px;margin:0 auto;border-collapse:collapse\">");

        // header: the logo, and its text when the client does not show images
        html.append("<tr><td style=\"padding:18px 28px;background:").append(PRIMARY)
                .append(";border-radius:12px 12px 0 0;color:#ffffff;font-size:24px;font-weight:bold\">")
                .append("<img src=\"cid:learnup-logo\" alt=\"LearnUP\" width=\"140\" ")
                .append("style=\"display:block;border:0;height:auto;color:#ffffff;font-size:24px;font-weight:bold\"/>")
                .append("</td></tr>");

        html.append("<tr><td style=\"padding:32px 28px;background:#ffffff;color:").append(PRIMARY).append("\">");
        if (card.badge != null) {
            html.append("<span style=\"display:inline-block;padding:4px 12px;border-radius:999px;background:")
                    .append(card.tone.tint).append(";color:").append(card.tone.accent)
                    .append(";font-size:12px;font-weight:bold\">").append(escape(card.badge)).append("</span>");
        }
        html.append("<h1 style=\"margin:14px 0 8px;font-size:22px;line-height:1.3\">")
                .append(escape(card.heading)).append("</h1>");
        if (card.greeted) {
            String name = card.greetingName == null ? "" : card.greetingName.strip();
            html.append("<p style=\"margin:0 0 16px;color:").append(TEXT).append(";font-size:15px\">")
                    .append(name.isEmpty() ? "Xin chào," : "Xin chào " + escape(name) + ",").append("</p>");
        }
        for (Object block : card.blocks) {
            if (block instanceof Button button) {
                appendButton(html, button);
            } else {
                html.append("<p style=\"margin:0 0 16px;color:").append(TEXT)
                        .append(";font-size:15px;line-height:1.6\">").append(escapeLines((String) block)).append("</p>");
            }
        }
        if (!card.details.isEmpty()) {
            appendDetails(html, card.details);
        }
        if (card.callout != null) {
            html.append("<div style=\"margin:0 0 16px;padding:14px 16px;background:").append(card.callout.tone.tint)
                    .append(";border-left:4px solid ").append(card.callout.tone.accent)
                    .append(";border-radius:4px\"><div style=\"color:").append(card.callout.tone.accent)
                    .append(";font-size:13px;font-weight:bold;margin-bottom:4px\">")
                    .append(escape(card.callout.heading)).append("</div><div style=\"color:").append(PRIMARY)
                    .append(";font-size:14px;line-height:1.6\">").append(escapeLines(card.callout.text))
                    .append("</div></div>");
        }
        if (card.closing != null) {
            html.append("<p style=\"margin:8px 0 0;color:").append(TEXT).append(";font-size:14px\">")
                    .append(escapeLines(card.closing)).append("</p>");
        }
        html.append("</td></tr>");

        html.append("<tr><td style=\"padding:16px 28px;background:#f8fafc;border-top:1px solid ").append(BORDER)
                .append(";border-radius:0 0 12px 12px;color:#94a3b8;font-size:12px;text-align:center\">")
                .append("Email tự động từ LearnUP, vui lòng không trả lời thư này.</td></tr>")
                .append("</table></body></html>");
        return html.toString();
    }

    private static void appendButton(StringBuilder html, Button button) {
        if (!isSafeUrl(button.url())) return;
        html.append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:8px 0 20px\">")
                .append("<tr><td style=\"border-radius:8px;background:").append(ACCENT).append("\">")
                .append("<a href=\"").append(escape(button.url())).append("\" style=\"display:inline-block;")
                .append("padding:12px 28px;font-size:15px;font-weight:bold;color:").append(PRIMARY)
                .append(";text-decoration:none;border-radius:8px\">").append(escape(button.label()))
                .append("</a></td></tr></table>");
    }

    private static void appendDetails(StringBuilder html, List<Row> rows) {
        html.append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" ")
                .append("style=\"margin:0 0 20px;border:1px solid ").append(BORDER)
                .append(";border-radius:8px;border-collapse:separate;font-size:14px\">");
        for (int i = 0; i < rows.size(); i++) {
            Row row = rows.get(i);
            String top = i == 0 ? "" : "border-top:1px solid " + BORDER + ";";
            String color = row.tone() == null ? PRIMARY : row.tone().accent;
            html.append("<tr><td style=\"padding:10px 14px;color:").append(MUTED).append(";width:110px;")
                    .append(top).append("\">").append(escape(row.label())).append("</td>")
                    .append("<td style=\"padding:10px 14px;font-weight:bold;color:").append(color).append(";")
                    .append(top).append("\">").append(escape(row.value())).append("</td></tr>");
        }
        html.append("</table>");
    }

    /** A link in a mail is http or https and nothing else (no javascript:, no data:). */
    static boolean isSafeUrl(String url) {
        return url != null && (url.startsWith("https://") || url.startsWith("http://")) && url.indexOf(' ') < 0
                && url.indexOf('"') < 0 && url.indexOf('<') < 0 && url.indexOf('>') < 0;
    }

    static String escape(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    /** Escaped, with a line break kept as one. */
    static String escapeLines(String value) {
        return escape(value).replace("\r\n", "\n").replace("\n", "<br/>");
    }
}
