package com.learnup.notification.enrollment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

public class SubmissionFinalizedEventParserTest {
    static final ObjectMapper MAPPER = new ObjectMapper();
    private final SubmissionFinalizedEventParser parser = new SubmissionFinalizedEventParser(MAPPER);

    public static SubmissionFinalizedEvent event() {
        return new SubmissionFinalizedEvent(UUID.randomUUID(), Instant.parse("2020-01-01T00:00:00Z"),
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "An toàn",
                new BigDecimal("66.67"), new BigDecimal("100.00"), UUID.randomUUID(),
                Instant.parse("2020-01-01T00:00:00Z"));
    }

    public static ObjectNode envelope(SubmissionFinalizedEvent event) {
        ObjectNode root = MAPPER.createObjectNode();
        root.put("eventId", event.eventId().toString()).put("eventType", "SubmissionFinalized")
                .put("version", 1).put("occurredAt", event.occurredAt().toString())
                .put("organizationId", event.organizationId().toString()).put("producer", "assessment-service");
        root.putObject("data").put("learnerId", event.learnerId().toString())
                .put("submissionId", event.submissionId().toString()).put("assessmentId", event.assessmentId().toString())
                .put("assessmentTitle", event.assessmentTitle()).put("finalScore", event.finalScore().toPlainString())
                .put("maxScore", event.maxScore().toPlainString()).put("courseId", event.courseId().toString())
                .put("finalizedAt", event.finalizedAt().toString());
        return root;
    }

    @Test void parsesAnOldResultWithoutDiscardingItAndIgnoresUnrelatedFields() {
        SubmissionFinalizedEvent event = event();
        ObjectNode root = envelope(event);
        ((ObjectNode) root.get("data")).putObject("unreadExtra").put("nested", true);
        assertThat(parser.parse(root.toString())).contains(event);
    }

    @ParameterizedTest
    @ValueSource(strings = {"eventId", "eventType", "version", "occurredAt", "organizationId", "producer", "data"})
    void requiresReadEnvelopeFields(String field) {
        ObjectNode root = envelope(event());
        root.remove(field);
        assertThatThrownBy(() -> parser.parse(root.toString())).isInstanceOf(InvalidEventException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"learnerId", "submissionId", "assessmentId", "assessmentTitle", "finalScore",
            "maxScore", "courseId", "finalizedAt"})
    void requiresEveryPayloadField(String field) {
        ObjectNode root = envelope(event());
        ((ObjectNode) root.get("data")).remove(field);
        assertThatThrownBy(() -> parser.parse(root.toString())).isInstanceOf(InvalidEventException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"-1", "100.01", "NaN", "1e2", "66.670", "01", "", " 80", "999999999999999999"})
    void rejectsNonCanonicalOrOutOfRangeScores(String value) {
        ObjectNode root = envelope(event());
        ((ObjectNode) root.get("data")).put("finalScore", value);
        assertThatThrownBy(() -> parser.parse(root.toString())).isInstanceOf(InvalidEventException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"not json", "null", "[]", "{}", "{\"eventType\":\"SubmissionFinalized\",\"version\":2}"})
    void rejectsMalformedMessages(String value) {
        assertThatThrownBy(() -> parser.parse(value)).isInstanceOf(InvalidEventException.class);
    }

    @Test void checksProvenanceVersionIdsDatesTitleAndStringScoreTypes() {
        ObjectNode root = envelope(event());
        root.put("producer", "other");
        assertInvalid(root);
        root = envelope(event()); root.put("version", 1.0); assertInvalid(root);
        root = envelope(event()); root.put("eventId", "1-1-1-1-1"); assertInvalid(root);
        root = envelope(event()); root.put("occurredAt", "2026-01-01T00:00:00+00:00"); assertInvalid(root);
        root = envelope(event()); ((ObjectNode) root.get("data")).put("assessmentTitle", "x".repeat(201)); assertInvalid(root);
        root = envelope(event()); ((ObjectNode) root.get("data")).put("finalScore", 80); assertInvalid(root);
        root = envelope(event()); ((ObjectNode) root.get("data")).put("maxScore", "100"); assertInvalid(root);
        root = envelope(event()); ((ObjectNode) root.get("data")).put("finalizedAt", "yesterday"); assertInvalid(root);
    }

    @Test void ignoresAnUnrelatedEventTypeWithoutValidatingItsPayload() {
        assertThat(parser.parse("{\"eventType\":\"AnotherEvent\"}")).isEmpty();
    }

    private void assertInvalid(ObjectNode root) {
        assertThatThrownBy(() -> parser.parse(root.toString())).isInstanceOf(InvalidEventException.class)
                .hasMessageNotContaining("An toàn");
    }
}
