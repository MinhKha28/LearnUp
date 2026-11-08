package com.learnup.notification.enrollment;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The envelope of PeerReviewAssigned, as assessment-service writes it (contracts/events/assessment-peer-review-events.md). */
class PeerReviewAssignedParserTest {

    private static final String EVENT = "1d3e3e55-7ace-4d48-ac9d-4c02355f8d9e";
    private static final String ORG = "cda775cb-4d21-410d-979f-c94c8ec8b516";
    private static final String REVIEWER = "188aa316-ed75-4fcb-a879-4dd3ad000a8a";
    private static final String ASSESSMENT = "b2ab8537-2234-4407-93ff-aff997ff4da9";
    private static final String CYCLE = "8eb38a24-7b2d-4598-a477-cb31f0ef2a84";

    private final PeerReviewAssignedParser parser = new PeerReviewAssignedParser(new ObjectMapper());

    private static String envelope(String eventType, String version, String data) {
        return """
                {"eventId":"%s","eventType":"%s","version":%s,"occurredAt":"2026-11-07T03:00:00.000Z",
                 "organizationId":"%s","producer":"assessment-service","data":%s}
                """.formatted(EVENT, eventType, version, ORG, data);
    }

    private static String data(String override) {
        String base = """
                {"learnerId":"%s","organizationId":"%s","assessmentId":"%s","cycleId":"%s",
                 "assignmentTitle":"Bài tập an toàn","reviewCount":2,"reviewDueAt":"2026-11-10T17:00:00.000Z"}
                """.formatted(REVIEWER, ORG, ASSESSMENT, CYCLE);
        return override.isEmpty() ? base : override;
    }

    private static String code(Throwable throwable) {
        return ((InvalidEventException) throwable).code();
    }

    @Test
    void anEventIsReadFromTheEnvelopeAndTheData() {
        PeerReviewAssignedEvent event = parser.parse(envelope("PeerReviewAssigned", "1", data(""))).orElseThrow();

        assertThat(event.eventId()).isEqualTo(UUID.fromString(EVENT));
        assertThat(event.occurredAt()).isEqualTo(Instant.parse("2026-11-07T03:00:00Z"));
        assertThat(event.organizationId()).isEqualTo(UUID.fromString(ORG));
        assertThat(event.reviewerId()).isEqualTo(UUID.fromString(REVIEWER));
        assertThat(event.assessmentId()).isEqualTo(UUID.fromString(ASSESSMENT));
        assertThat(event.cycleId()).isEqualTo(UUID.fromString(CYCLE));
        assertThat(event.assignmentTitle()).isEqualTo("Bài tập an toàn");
        assertThat(event.reviewCount()).isEqualTo(2);
        assertThat(event.reviewDueAt()).isEqualTo(Instant.parse("2026-11-10T17:00:00Z"));
    }

    @Test
    void theOrganizationOfTheEnvelopeIsTheTruthAndTheCopyInDataIsNotRead() {
        String other = "00000000-0000-4000-8000-0000000000ff";
        // the copy in data names another Organization; the envelope says ORG
        String inData = data("").replace("\"organizationId\":\"" + ORG + "\"", "\"organizationId\":\"" + other + "\"");
        PeerReviewAssignedEvent event = parser.parse(envelope("PeerReviewAssigned", "1", inData)).orElseThrow();
        assertThat(event.organizationId()).isEqualTo(UUID.fromString(ORG));
    }

    @Test
    void anotherTypeOfEventIsIgnoredNotRefused() {
        assertThat(parser.parse(envelope("LearnerAssessmentStatusChanged", "1", "{}"))).isEmpty();
        assertThat(parser.parse(envelope("EnrollmentAssigned", "1", "{}"))).isEmpty();
    }

    @Test
    void aTitleIsKeptWithoutItsSpacesAtTheEnds() {
        PeerReviewAssignedEvent event = parser.parse(envelope("PeerReviewAssigned", "1",
                data("").replace("Bài tập an toàn", "  Bài tập an toàn  "))).orElseThrow();
        assertThat(event.assignmentTitle()).isEqualTo("Bài tập an toàn");
    }

    @Test
    void aMessageThatIsNotAnEventIsRefusedWithAFixedCode() {
        assertThatThrownBy(() -> parser.parse("not json")).satisfies(t -> assertThat(code(t)).isEqualTo("NOT_JSON"));
        assertThatThrownBy(() -> parser.parse("[1]")).satisfies(t -> assertThat(code(t)).isEqualTo("NOT_AN_OBJECT"));
        assertThatThrownBy(() -> parser.parse("{}")).satisfies(t -> assertThat(code(t)).isEqualTo("MISSING_EVENT_TYPE"));
        assertThatThrownBy(() -> parser.parse(envelope("PeerReviewAssigned", "2", data(""))))
                .satisfies(t -> assertThat(code(t)).isEqualTo("UNSUPPORTED_VERSION"));
        assertThatThrownBy(() -> parser.parse(envelope("PeerReviewAssigned", "1", "[]")))
                .satisfies(t -> assertThat(code(t)).isEqualTo("MISSING_DATA"));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "\"learnerId\":\"" + REVIEWER + "\"|\"learnerId\":\"nope\"|INVALID_LEARNER_ID",
            "\"reviewCount\":2|\"reviewCount\":0|INVALID_REVIEW_COUNT",
            "\"reviewCount\":2|\"reviewCount\":\"2\"|INVALID_REVIEW_COUNT",
            "\"reviewCount\":2|\"reviewCount\":2.5|INVALID_REVIEW_COUNT",
            "\"reviewDueAt\":\"2026-11-10T17:00:00.000Z\"|\"reviewDueAt\":\"tomorrow\"|INVALID_REVIEW_DUE_AT",
            "\"assignmentTitle\":\"Bài tập an toàn\"|\"assignmentTitle\":\"  \"|INVALID_ASSIGNMENT_TITLE",
            "\"cycleId\":\"" + CYCLE + "\"|\"cycleId\":\"1\"|INVALID_CYCLE_ID",
            "\"assessmentId\":\"" + ASSESSMENT + "\"|\"assessmentId\":null|INVALID_ASSESSMENT_ID",
    })
    void aBrokenFieldIsRefusedWithItsOwnCode(String from, String to, String expected) {
        String broken = data("").replace(from, to);
        assertThatThrownBy(() -> parser.parse(envelope("PeerReviewAssigned", "1", broken)))
                .satisfies(t -> assertThat(code(t)).isEqualTo(expected));
    }

    @Test
    void aTitleOfMoreThan300CharactersIsRefused() {
        String broken = data("").replace("Bài tập an toàn", "x".repeat(301));
        assertThatThrownBy(() -> parser.parse(envelope("PeerReviewAssigned", "1", broken)))
                .satisfies(t -> assertThat(code(t)).isEqualTo("INVALID_ASSIGNMENT_TITLE"));
    }
}
