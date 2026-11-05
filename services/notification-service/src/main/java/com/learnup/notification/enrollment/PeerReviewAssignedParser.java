package com.learnup.notification.enrollment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Optional;
import java.util.UUID;

/**
 * Reads the envelope of a {@code PeerReviewAssigned} event of assessment-service (contracts/events/assessment-peer-review-events.md).
 * As for the enrollment events, the envelope is the source of the event id, the time and the Organization. Any other
 * event type gives an empty result; a message that is not a valid event throws {@link InvalidEventException}, which
 * goes to the dead-letter topic without a retry.
 */
@Component
public class PeerReviewAssignedParser {

    static final int SUPPORTED_VERSION = 1;
    static final int TITLE_MAX_LENGTH = 300;

    private final ObjectMapper objectMapper;

    public PeerReviewAssignedParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public Optional<PeerReviewAssignedEvent> parse(String json) {
        JsonNode root;
        try {
            root = objectMapper.readTree(json);
        } catch (Exception e) {
            throw new InvalidEventException("NOT_JSON");
        }
        if (root == null || !root.isObject()) {
            throw new InvalidEventException("NOT_AN_OBJECT");
        }
        if (!PeerReviewAssignedEvent.WIRE_NAME.equals(text(root, "eventType", "MISSING_EVENT_TYPE"))) {
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

        UUID reviewerId = uuid(data, "learnerId", "INVALID_LEARNER_ID");
        UUID assessmentId = uuid(data, "assessmentId", "INVALID_ASSESSMENT_ID");
        UUID cycleId = uuid(data, "cycleId", "INVALID_CYCLE_ID");
        String title = text(data, "assignmentTitle", "INVALID_ASSIGNMENT_TITLE").strip();
        if (title.length() > TITLE_MAX_LENGTH) {
            throw new InvalidEventException("INVALID_ASSIGNMENT_TITLE");
        }
        JsonNode count = data.get("reviewCount");
        if (count == null || !count.isInt() || count.asInt() < 1) {
            throw new InvalidEventException("INVALID_REVIEW_COUNT");
        }
        Instant reviewDueAt = instant(data, "reviewDueAt", "INVALID_REVIEW_DUE_AT");
        return Optional.of(new PeerReviewAssignedEvent(eventId, occurredAt, organizationId, reviewerId, assessmentId,
                cycleId, title, count.asInt(), reviewDueAt));
    }

    private static String text(JsonNode node, String field, String code) {
        JsonNode value = node.get(field);
        if (value == null || !value.isTextual() || value.asText().isBlank()) {
            throw new InvalidEventException(code);
        }
        return value.asText();
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
}
