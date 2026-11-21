package com.learnup.notification.enrollment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Optional;
import java.util.UUID;

@Component
public class SubmissionFinalizedEventParser {
    private static final BigDecimal MAX_SCORE = new BigDecimal("100.00");
    private static final int TITLE_LIMIT = 200;
    private final ObjectMapper mapper;

    public SubmissionFinalizedEventParser(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public Optional<SubmissionFinalizedEvent> parse(String json) {
        JsonNode root;
        try {
            root = mapper.readTree(json);
        } catch (Exception failure) {
            throw new InvalidEventException("NOT_JSON");
        }
        if (root == null || !root.isObject()) throw new InvalidEventException("INVALID_ENVELOPE");
        if (!SubmissionFinalizedEvent.WIRE_NAME.equals(text(root, "eventType"))) return Optional.empty();
        if (!root.path("version").isInt() || root.path("version").intValue() != 1) {
            throw new InvalidEventException("UNSUPPORTED_VERSION");
        }
        if (!"assessment-service".equals(text(root, "producer"))) {
            throw new InvalidEventException("INVALID_PRODUCER");
        }
        JsonNode data = root.path("data");
        if (!data.isObject()) throw new InvalidEventException("MISSING_DATA");
        String title = text(data, "assessmentTitle");
        if (title.codePointCount(0, title.length()) > TITLE_LIMIT || title.indexOf('\0') >= 0) {
            throw new InvalidEventException("INVALID_ASSESSMENT_TITLE");
        }
        BigDecimal score = decimal(data, "finalScore");
        BigDecimal maximum = decimal(data, "maxScore");
        if (!"100.00".equals(text(data, "maxScore")) || maximum.compareTo(MAX_SCORE) != 0) {
            throw new InvalidEventException("INVALID_MAX_SCORE");
        }
        return Optional.of(new SubmissionFinalizedEvent(uuid(root, "eventId"), instant(root, "occurredAt"),
                uuid(root, "organizationId"), uuid(data, "learnerId"), uuid(data, "submissionId"),
                uuid(data, "assessmentId"), title, score, maximum, uuid(data, "courseId"),
                instant(data, "finalizedAt")));
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (!value.isTextual() || value.textValue().isBlank()) throw new InvalidEventException("INVALID_FIELD");
        return value.textValue();
    }

    private static UUID uuid(JsonNode node, String field) {
        String value = text(node, field);
        try {
            UUID id = UUID.fromString(value);
            if (!id.toString().equalsIgnoreCase(value)) throw new IllegalArgumentException();
            return id;
        } catch (IllegalArgumentException failure) {
            throw new InvalidEventException("INVALID_UUID");
        }
    }

    private static Instant instant(JsonNode node, String field) {
        String value = text(node, field);
        try {
            if (!value.endsWith("Z")) throw new DateTimeParseException("UTC required", "", 0);
            return Instant.parse(value);
        } catch (DateTimeParseException failure) {
            throw new InvalidEventException("INVALID_TIMESTAMP");
        }
    }

    private static BigDecimal decimal(JsonNode data, String field) {
        String value = text(data, field);
        if (!value.matches("(?:0|[1-9][0-9]{0,2})(?:\\.[0-9]{1,2})?")) {
            throw new InvalidEventException("INVALID_SCORE");
        }
        BigDecimal score = new BigDecimal(value);
        if (score.compareTo(MAX_SCORE) > 0) throw new InvalidEventException("INVALID_SCORE");
        return score;
    }
}
