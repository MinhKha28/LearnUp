package com.learnup.notification.enrollment;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EnrollmentEventParserTest {

    private static final String EVENT = "1d3e3e55-7ace-4d48-ac9d-4c02355f8d9e";
    private static final String ORG = "cda775cb-4d21-410d-979f-c94c8ec8b516";
    private static final String ENROLLMENT = "8eb38a24-7b2d-4598-a477-cb31f0ef2a84";
    private static final String LEARNER = "188aa316-ed75-4fcb-a879-4dd3ad000a8a";
    private static final String COURSE = "b2ab8537-2234-4407-93ff-aff997ff4da9";

    private final EnrollmentEventParser parser = new EnrollmentEventParser(new ObjectMapper());

    private static String envelope(String eventType, String data) {
        return """
                {"eventId":"%s","eventType":"%s","version":1,"occurredAt":"2026-10-27T01:00:00.000Z",
                 "organizationId":"%s","producer":"learning-service","data":%s}
                """.formatted(EVENT, eventType, ORG, data);
    }

    private static String data(String more) {
        return """
                {"enrollmentId":"%s","learnerId":"%s","courseId":"%s"%s}
                """.formatted(ENROLLMENT, LEARNER, COURSE, more.isEmpty() ? "" : "," + more);
    }

    private static String code(Throwable throwable) {
        return ((InvalidEventException) throwable).code();
    }

    @Test
    void anAssignmentIsReadFromTheEnvelopeAndTheData() {
        EnrollmentEvent event = parser.parse(envelope("EnrollmentAssigned",
                data("\"kind\":\"CREATE\",\"dueAt\":\"2026-12-01T00:00:00.000Z\",\"assignedBy\":\"" + ORG + "\""))).orElseThrow();

        assertThat(event.eventId()).isEqualTo(UUID.fromString(EVENT));
        assertThat(event.type()).isEqualTo(EnrollmentEventType.ASSIGNED);
        assertThat(event.occurredAt()).isEqualTo(Instant.parse("2026-10-27T01:00:00Z"));
        assertThat(event.organizationId()).isEqualTo(UUID.fromString(ORG));
        assertThat(event.enrollmentId()).isEqualTo(UUID.fromString(ENROLLMENT));
        assertThat(event.learnerId()).isEqualTo(UUID.fromString(LEARNER));
        assertThat(event.courseId()).isEqualTo(UUID.fromString(COURSE));
        assertThat(event.kind()).isEqualTo(AssignmentKind.CREATE);
        assertThat(event.dueAt()).isEqualTo(Instant.parse("2026-12-01T00:00:00Z"));
    }

    @Test
    void theEnvelopeIsTheTruthAndTheCopyInDataIsNotRead() {
        String other = "00000000-0000-4000-8000-0000000000ff";
        EnrollmentEvent event = parser.parse(envelope("EnrollmentAssigned",
                data("\"kind\":\"CREATE\",\"dueAt\":\"2026-12-01T00:00:00Z\",\"organizationId\":\"" + other
                        + "\",\"eventId\":\"" + other + "\",\"occurredAt\":\"2020-01-01T00:00:00Z\""))).orElseThrow();

        assertThat(event.organizationId()).isEqualTo(UUID.fromString(ORG));
        assertThat(event.eventId()).isEqualTo(UUID.fromString(EVENT));
        assertThat(event.occurredAt()).isEqualTo(Instant.parse("2026-10-27T01:00:00Z"));
    }

    @Test
    void everyKindThatHasADueDateNeedsIt() {
        for (String kind : new String[]{"CREATE", "CONVERT", "RESTORE"}) {
            assertThat(parser.parse(envelope("EnrollmentAssigned",
                    data("\"kind\":\"" + kind + "\",\"dueAt\":\"2026-12-01T00:00:00Z\""))).orElseThrow().kind().name())
                    .isEqualTo(kind);
            assertThatThrownBy(() -> parser.parse(envelope("EnrollmentAssigned", data("\"kind\":\"" + kind + "\""))))
                    .satisfies(e -> assertThat(code(e)).isEqualTo("MISSING_DUE_AT"));
        }
    }

    @Test
    void aConversionOfACompletedEnrollmentHasNoDueDateEvenIfOneIsSent() {
        EnrollmentEvent withoutDate = parser.parse(envelope("EnrollmentAssigned",
                data("\"kind\":\"CONVERT_COMPLETED\"")) ).orElseThrow();
        EnrollmentEvent withDate = parser.parse(envelope("EnrollmentAssigned",
                data("\"kind\":\"CONVERT_COMPLETED\",\"dueAt\":\"2026-12-01T00:00:00Z\""))).orElseThrow();
        assertThat(withoutDate.dueAt()).isNull();
        assertThat(withDate.dueAt()).isNull();
    }

    @Test
    void anExtensionKeepsTheNewDateThePreviousOneAndTheReason() {
        EnrollmentEvent event = parser.parse(envelope("EnrollmentDueDateExtended", data(
                "\"previousDueAt\":\"2026-12-01T00:00:00Z\",\"newDueAt\":\"2026-12-08T00:00:00Z\",\"reason\":\"  Bận công tác  \",\"actorId\":\"" + ORG + "\""))).orElseThrow();
        assertThat(event.type()).isEqualTo(EnrollmentEventType.DUE_DATE_EXTENDED);
        assertThat(event.previousDueAt()).isEqualTo(Instant.parse("2026-12-01T00:00:00Z"));
        assertThat(event.newDueAt()).isEqualTo(Instant.parse("2026-12-08T00:00:00Z"));
        assertThat(event.reason()).isEqualTo("Bận công tác");
    }

    @Test
    void anExtensionNeedsTheNewDateButNotTheReason() {
        EnrollmentEvent event = parser.parse(envelope("EnrollmentDueDateExtended",
                data("\"newDueAt\":\"2026-12-08T00:00:00Z\",\"reason\":null"))).orElseThrow();
        assertThat(event.reason()).isNull();
        assertThat(event.previousDueAt()).isNull();
        assertThatThrownBy(() -> parser.parse(envelope("EnrollmentDueDateExtended", data("\"reason\":\"x\""))))
                .satisfies(e -> assertThat(code(e)).isEqualTo("INVALID_NEW_DUE_AT"));
    }

    @Test
    void anExemptionKeepsTheReason() {
        EnrollmentEvent event = parser.parse(envelope("EnrollmentExempted",
                data("\"reason\":\"Đã có chứng chỉ tương đương\",\"exemptedAt\":\"2026-10-27T01:00:00Z\""))).orElseThrow();
        assertThat(event.type()).isEqualTo(EnrollmentEventType.EXEMPTED);
        assertThat(event.reason()).isEqualTo("Đã có chứng chỉ tương đương");
    }

    @Test
    void aWithdrawalIsReadToo() {
        EnrollmentEvent event = parser.parse(envelope("LearnerWithdrew",
                data("\"withdrawnAt\":\"2026-10-27T01:00:00Z\""))).orElseThrow();
        assertThat(event.type()).isEqualTo(EnrollmentEventType.WITHDREW);
    }

    @Test
    void anEventTypeThatIsNotForThisServiceIsIgnored() {
        assertThat(parser.parse(envelope("EnrollmentCompleted", data("\"completedAt\":\"2026-10-27T01:00:00Z\""))))
                .isEqualTo(Optional.empty());
        assertThat(parser.parse(envelope("SomethingNew", "{}"))).isEmpty();
    }

    @Test
    void anUnsupportedVersionIsInvalid() {
        String v2 = envelope("EnrollmentExempted", data("\"reason\":\"x\"")).replace("\"version\":1", "\"version\":2");
        assertThatThrownBy(() -> parser.parse(v2)).satisfies(e -> assertThat(code(e)).isEqualTo("UNSUPPORTED_VERSION"));
        String noVersion = envelope("EnrollmentExempted", data("\"reason\":\"x\"")).replace("\"version\":1,", "");
        assertThatThrownBy(() -> parser.parse(noVersion)).satisfies(e -> assertThat(code(e)).isEqualTo("UNSUPPORTED_VERSION"));
    }

    @Test
    void whatIsNotAnEventIsInvalid() {
        assertThatThrownBy(() -> parser.parse("not json {")).satisfies(e -> assertThat(code(e)).isEqualTo("NOT_JSON"));
        assertThatThrownBy(() -> parser.parse("[1,2]")).satisfies(e -> assertThat(code(e)).isEqualTo("NOT_AN_OBJECT"));
        assertThatThrownBy(() -> parser.parse("{}")).satisfies(e -> assertThat(code(e)).isEqualTo("MISSING_EVENT_TYPE"));
    }

    @Test
    void aMissingOrBadFieldIsInvalid() {
        String good = envelope("EnrollmentExempted", data("\"reason\":\"x\""));
        assertThatThrownBy(() -> parser.parse(good.replace(EVENT, "nope")))
                .satisfies(e -> assertThat(code(e)).isEqualTo("INVALID_EVENT_ID"));
        assertThatThrownBy(() -> parser.parse(good.replace("2026-10-27T01:00:00.000Z", "yesterday")))
                .satisfies(e -> assertThat(code(e)).isEqualTo("INVALID_OCCURRED_AT"));
        assertThatThrownBy(() -> parser.parse(good.replace("\"organizationId\":\"" + ORG + "\",\"producer\"", "\"producer\"")))
                .satisfies(e -> assertThat(code(e)).isEqualTo("INVALID_ORGANIZATION_ID"));
        assertThatThrownBy(() -> parser.parse(good.replace(LEARNER, "nope")))
                .satisfies(e -> assertThat(code(e)).isEqualTo("INVALID_LEARNER_ID"));
        assertThatThrownBy(() -> parser.parse(envelope("EnrollmentExempted", "null")))
                .satisfies(e -> assertThat(code(e)).isEqualTo("MISSING_DATA"));
    }

    @Test
    void anUnknownKindIsInvalid() {
        assertThatThrownBy(() -> parser.parse(envelope("EnrollmentAssigned",
                data("\"kind\":\"created\",\"dueAt\":\"2026-12-01T00:00:00Z\""))))
                .satisfies(e -> assertThat(code(e)).isEqualTo("INVALID_KIND"));
    }

    @Test
    void anErrorNeverCarriesTextOfThePayload() {
        String secret = "SECRET-NAME-IN-THE-PAYLOAD";
        for (String bad : new String[]{
                envelope("EnrollmentAssigned", data("\"kind\":\"" + secret + "\"")),
                envelope("EnrollmentAssigned", data("\"kind\":\"CREATE\",\"dueAt\":\"" + secret + "\"")),
                "{\"eventType\":\"" + secret + "\"",
                envelope("EnrollmentExempted", data("\"reason\":\"x\"")).replace(LEARNER, secret)}) {
            try {
                parser.parse(bad);
            } catch (InvalidEventException e) {
                assertThat(e.getMessage()).doesNotContain(secret);
                assertThat(e.code()).doesNotContain(secret);
            }
        }
    }
}
