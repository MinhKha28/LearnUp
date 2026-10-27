package com.learnup.notification.enrollment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Optional;
import java.util.UUID;

/**
 * Reads the envelope of an event of the learning enrollment topic (contracts/events/learning-enrollment-events.md).
 * The envelope is the source of the event id, the time and the Organization; {@code data} repeats some of them and
 * that copy is not read. An event type that this service does not act on gives an empty result; a message that is
 * not a valid event throws {@link InvalidEventException}.
 */
@Component
public class EnrollmentEventParser {

    static final int SUPPORTED_VERSION = 1;

    private final ObjectMapper objectMapper;

    public EnrollmentEventParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public Optional<EnrollmentEvent> parse(String json) {
        JsonNode root;
        try {
            root = objectMapper.readTree(json);
        } catch (Exception e) {
            throw new InvalidEventException("NOT_JSON");
        }
        if (root == null || !root.isObject()) {
            throw new InvalidEventException("NOT_AN_OBJECT");
        }

        String typeName = text(root, "eventType", "MISSING_EVENT_TYPE");
        Optional<EnrollmentEventType> type = EnrollmentEventType.fromWireName(typeName);
        if (type.isEmpty()) {
            return Optional.empty();
        }
        if (!root.path("version").isInt() || root.get("version").asInt() != SUPPORTED_VERSION) {
            throw new InvalidEventException("UNSUPPORTED_VERSION");
        }
        UUID eventId = uuid(root, "eventId", "INVALID_EVENT_ID");
        Instant occurredAt = instant(root, "occurredAt", "INVALID_OCCURRED_AT");
        UUID organizationId = uuid(root, "organizationId", "INVALID_ORGANIZATION_ID");
        JsonNode data = root.get("data");
        if (data == null || !data.isObject()) {
            throw new InvalidEventException("MISSING_DATA");
        }

        UUID enrollmentId = uuid(data, "enrollmentId", "INVALID_ENROLLMENT_ID");
        UUID learnerId = uuid(data, "learnerId", "INVALID_LEARNER_ID");
        UUID courseId = uuid(data, "courseId", "INVALID_COURSE_ID");

        AssignmentKind kind = null;
        Instant dueAt = null;
        Instant previousDueAt = null;
        Instant newDueAt = null;
        String reason = null;
        switch (type.get()) {
            case ASSIGNED -> {
                kind = kind(data);
                dueAt = optionalInstant(data, "dueAt", "INVALID_DUE_AT");
                if (kind.hasDueDate() && dueAt == null) {
                    throw new InvalidEventException("MISSING_DUE_AT");
                }
                if (!kind.hasDueDate()) {
                    dueAt = null;
                }
            }
            case DUE_DATE_EXTENDED -> {
                newDueAt = instant(data, "newDueAt", "INVALID_NEW_DUE_AT");
                previousDueAt = optionalInstant(data, "previousDueAt", "INVALID_PREVIOUS_DUE_AT");
                reason = optionalText(data, "reason");
            }
            case EXEMPTED -> reason = optionalText(data, "reason");
            case WITHDREW -> {
                // Nothing more is needed: nobody is written to for a withdrawal.
            }
        }
        return Optional.of(new EnrollmentEvent(eventId, type.get(), occurredAt, organizationId, enrollmentId,
                learnerId, courseId, kind, dueAt, previousDueAt, newDueAt, reason));
    }

    private static AssignmentKind kind(JsonNode data) {
        String value = text(data, "kind", "INVALID_KIND");
        try {
            return AssignmentKind.valueOf(value);
        } catch (IllegalArgumentException e) {
            throw new InvalidEventException("INVALID_KIND");
        }
    }

    private static String text(JsonNode node, String field, String code) {
        JsonNode value = node.get(field);
        if (value == null || !value.isTextual() || value.asText().isBlank()) {
            throw new InvalidEventException(code);
        }
        return value.asText();
    }

    private static String optionalText(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull() || !value.isTextual() || value.asText().isBlank()) {
            return null;
        }
        return value.asText().trim();
    }

    private static UUID uuid(JsonNode node, String field, String code) {
        try {
            return UUID.fromString(text(node, field, code));
        } catch (IllegalArgumentException e) {
            throw new InvalidEventException(code);
        }
    }

    private static Instant instant(JsonNode node, String field, String code) {
        try {
            return Instant.parse(text(node, field, code));
        } catch (DateTimeParseException e) {
            throw new InvalidEventException(code);
        }
    }

    private static Instant optionalInstant(JsonNode node, String field, String code) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return null;
        }
        return instant(node, field, code);
    }
}
