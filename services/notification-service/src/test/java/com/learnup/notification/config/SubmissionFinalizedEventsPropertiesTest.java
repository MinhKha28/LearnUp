package com.learnup.notification.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

class SubmissionFinalizedEventsPropertiesTest {
    @Test void disabledConsumerNeedsNoFrontendUrlAndHasApprovedDefaults() {
        var properties = new SubmissionFinalizedEventsProperties();
        assertThatCode(properties::validate).doesNotThrowAnyException();
        assertThat(properties.getRetryAttempts()).isEqualTo(10);
        assertThat(properties.getRetryInitialMs()).isEqualTo(1000);
        assertThat(properties.getRetryMaxMs()).isEqualTo(30000);
        assertThat(properties.getDlt()).isEqualTo("learnup.assessment.submission-finalized.DLT");
        assertThat(properties.getGroupId()).isEqualTo("notification-submission-finalized-v1");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "/relative", "ftp://example.com", "https:///missing",
            "https://user:secret@example.com", "https://example.com?query=x", "https://example.com/#fragment"})
    void enabledConsumerRejectsUnsafeBaseUrlsWithoutEchoingThem(String url) {
        var properties = new SubmissionFinalizedEventsProperties();
        properties.setEnabled(true); properties.setFrontendBaseUrl(url);
        assertThatThrownBy(properties::validate).isInstanceOf(IllegalArgumentException.class)
                .hasMessage("INVALID_FRONTEND_BASE_URL");
    }

    @Test void preservesAnAlreadyEncodedDeploymentSubpath() {
        var properties = new SubmissionFinalizedEventsProperties();
        properties.setFrontendBaseUrl("HTTPS://example.com/learn%20up/");
        UUID id = UUID.randomUUID();
        assertThat(properties.resultUrl(id)).isEqualTo("https://example.com/learn%20up/learner/courses/by-course/" + id + "/results");
    }
    @Test void preservesDeploymentSubpathAndNormalizesTrailingSlashes() {
        var properties = new SubmissionFinalizedEventsProperties();
        properties.setEnabled(true); properties.setFrontendBaseUrl("https://example.com/app///");
        properties.validate();
        UUID id = UUID.randomUUID();
        assertThat(properties.resultUrl(id)).isEqualTo("https://example.com/app/learner/courses/by-course/" + id + "/results");
        properties.setRetryAttempts(0);
        assertThatThrownBy(properties::validate).hasMessage("INVALID_SUBMISSION_FINALIZED_CONFIG");
    }
}
