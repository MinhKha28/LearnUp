package com.learnup.notification.course;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.notification.enrollment.InvalidEventException;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/** Parses {@code CoursePublished} / {@code CourseRejected} (version 1); other Course events are not for this parser. */
@Component
public class CourseDecisionEventParser {
    static final int MAX_REASON_LENGTH = 1000;

    private final ObjectMapper mapper;

    public CourseDecisionEventParser(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public Optional<CourseDecisionEvent> parse(String json) {
        JsonNode root;
        try {
            root = mapper.readTree(json);
        } catch (Exception ignored) {
            throw new InvalidEventException("NOT_JSON");
        }
        if (root == null || !root.isObject()) throw new InvalidEventException("INVALID_ENVELOPE");
        String eventType = text(root, "eventType", "INVALID_EVENT_TYPE");
        boolean approved = "CoursePublished".equals(eventType);
        if (!approved && !"CourseRejected".equals(eventType)) return Optional.empty();
        if (!root.path("version").isIntegralNumber() || root.path("version").asInt() != 1)
            throw new InvalidEventException("UNSUPPORTED_VERSION");
        if (!"course-service".equals(text(root, "producer", "INVALID_PRODUCER")))
            throw new InvalidEventException("INVALID_PRODUCER");

        UUID eventId = uuid(root, "eventId");
        UUID organizationId = uuid(root, "organizationId");
        Instant occurredAt = instant(root, "occurredAt");
        JsonNode data = root.get("data");
        if (data == null || !data.isObject()) throw new InvalidEventException("MISSING_DATA");
        UUID courseId = uuid(data, "courseId");
        UUID instructorId = uuid(data, "instructorId");
        UUID dataOrg = uuid(data, "organizationId");
        Instant payloadOccurred = instant(data, "occurredAt");
        String name = text(data, "courseName", "INVALID_COURSE_NAME");
        JsonNode version = data.get("versionNumber");
        if (version == null || !version.isIntegralNumber() || !version.canConvertToInt() || version.asInt() < 1)
            throw new InvalidEventException("INVALID_VERSION_NUMBER");
        if (!organizationId.equals(dataOrg) || !occurredAt.equals(payloadOccurred))
            throw new InvalidEventException("EVENT_SCOPE_MISMATCH");

        String reason = null;
        if (approved) {
            instant(data, "publishedAt");
        } else {
            instant(data, "rejectedAt");
            // BR-337 / UC21.3: a rejection always carries its reason, which the Instructor needs to revise the Course.
            reason = text(data, "rejectionReason", "INVALID_REJECTION_REASON").trim();
            if (reason.length() > MAX_REASON_LENGTH) throw new InvalidEventException("INVALID_REJECTION_REASON");
        }
        return Optional.of(new CourseDecisionEvent(eventId, organizationId, courseId, instructorId, name,
                version.asInt(), approved, reason, occurredAt));
    }

    private static String text(JsonNode node, String key, String code) {
        JsonNode value = node.get(key);
        if (value == null || !value.isTextual() || value.asText().isBlank()) throw new InvalidEventException(code);
        return value.asText();
    }

    private static UUID uuid(JsonNode node, String key) {
        String value = text(node, key, "INVALID_" + key.toUpperCase());
        try {
            UUID parsed = UUID.fromString(value);
            if (!parsed.toString().equalsIgnoreCase(value)) throw new IllegalArgumentException();
            return parsed;
        } catch (IllegalArgumentException e) {
            throw new InvalidEventException("INVALID_" + key.toUpperCase());
        }
    }

    private static Instant instant(JsonNode node, String key) {
        try {
            return Instant.parse(text(node, key, "INVALID_" + key.toUpperCase()));
        } catch (java.time.format.DateTimeParseException e) {
            throw new InvalidEventException("INVALID_" + key.toUpperCase());
        }
    }
}
