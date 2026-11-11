package com.learnup.notification.course;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.notification.enrollment.InvalidEventException;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Component
public class CourseOwnershipTransferredEventParser {
    private final ObjectMapper mapper;

    public CourseOwnershipTransferredEventParser(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public Optional<CourseOwnershipTransferredEvent> parse(String json) {
        JsonNode root;
        try {
            root = mapper.readTree(json);
        } catch (Exception ignored) {
            throw new InvalidEventException("NOT_JSON");
        }
        if (root == null || !root.isObject()) {
            throw new InvalidEventException("INVALID_ENVELOPE");
        }
        if (!"CourseOwnershipTransferred".equals(root.path("eventType").asText())) {
            return Optional.empty();
        }
        if (!root.path("version").isIntegralNumber() || root.path("version").asInt() != 1
                || !"course-service".equals(text(root, "producer"))) {
            throw new InvalidEventException("INVALID_OWNERSHIP_ENVELOPE");
        }
        JsonNode data = root.path("data");
        if (!data.isObject()) throw new InvalidEventException("MISSING_DATA");

        UUID eventId = uuid(root, "eventId");
        UUID orgId = uuid(root, "organizationId");
        Instant occurredAt = instant(root, "occurredAt");
        if (!orgId.equals(uuid(data, "organizationId"))
                || !occurredAt.equals(instant(data, "occurredAt"))) {
            throw new InvalidEventException("EVENT_SCOPE_MISMATCH");
        }
        String reason = data.path("reason").isMissingNode() || data.path("reason").isNull()
                ? null : text(data, "reason");
        if (reason != null && reason.length() > 1000) {
            throw new InvalidEventException("INVALID_REASON");
        }
        return Optional.of(new CourseOwnershipTransferredEvent(
                eventId, orgId, uuid(data, "courseId"), uuid(data, "chainId"),
                uuid(data, "fromInstructorId"), uuid(data, "toInstructorId"),
                uuid(data, "actorUserId"), text(data, "courseName"), reason, occurredAt));
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.isTextual() || value.asText().isBlank()) {
            throw new InvalidEventException("INVALID_" + field.toUpperCase());
        }
        return value.asText();
    }

    private static UUID uuid(JsonNode node, String field) {
        try {
            String value = text(node, field);
            UUID result = UUID.fromString(value);
            if (!result.toString().equalsIgnoreCase(value)) throw new IllegalArgumentException();
            return result;
        } catch (IllegalArgumentException e) {
            throw new InvalidEventException("INVALID_" + field.toUpperCase());
        }
    }

    private static Instant instant(JsonNode node, String field) {
        try {
            return Instant.parse(text(node, field));
        } catch (java.time.format.DateTimeParseException e) {
            throw new InvalidEventException("INVALID_" + field.toUpperCase());
        }
    }
}
