package com.learnup.notification.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.assertThat;

class NotificationLinksTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @ParameterizedTest
    @ValueSource(strings = {"/learner/courses/by-course/id/results", "/results?q=1#score"})
    void acceptsInternalPaths(String link) throws Exception {
        assertThat(NotificationLinks.fromMetadata(mapper.writeValueAsString(Map.of("link", link)))).isEqualTo(link);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "{", "{} {}", "{\"link\":\"/results\"} trailing", "[]", "null", "1", "{}", "{\"link\":1}", "{\"link\":null}"})
    void ignoresMissingAndMalformedMetadata(String metadata) {
        assertThat(NotificationLinks.fromMetadata(metadata)).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com",
            "https://evil.com", "javascript:alert(1)", "relative", "/path with space", "/path\u0000",
            "/path\\tail", "/path\u00a0tail"})
    void rejectsUnsafePaths(String link) throws Exception {
        assertThat(NotificationLinks.fromMetadata(mapper.writeValueAsString(Map.of("link", link)))).isNull();
    }
}
