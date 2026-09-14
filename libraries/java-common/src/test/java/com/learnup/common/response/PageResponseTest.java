package com.learnup.common.response;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PageResponseTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("Should correctly calculate pagination metadata for middle page")
    void shouldCalculatePaginationForMiddlePage() {
        List<String> items = List.of("Item 1", "Item 2");
        PageResponse<String> pageResponse = PageResponse.of(items, 1, 2, 5);

        assertThat(pageResponse.getItems()).containsExactly("Item 1", "Item 2");
        assertThat(pageResponse.getPage()).isEqualTo(1);
        assertThat(pageResponse.getSize()).isEqualTo(2);
        assertThat(pageResponse.getTotalElements()).isEqualTo(5);
        assertThat(pageResponse.getTotalPages()).isEqualTo(3);
        assertThat(pageResponse.isFirst()).isFalse();
        assertThat(pageResponse.isLast()).isFalse();
    }

    @Test
    @DisplayName("Should correctly identify first and last page when single page exists")
    void shouldIdentifySinglePage() {
        List<String> items = List.of("Item 1");
        PageResponse<String> pageResponse = PageResponse.of(items, 0, 10, 1);

        assertThat(pageResponse.getTotalPages()).isEqualTo(1);
        assertThat(pageResponse.isFirst()).isTrue();
        assertThat(pageResponse.isLast()).isTrue();
    }

    @Test
    @DisplayName("Should handle empty results cleanly")
    void shouldHandleEmptyResults() throws JsonProcessingException {
        PageResponse<String> pageResponse = PageResponse.empty(0, 20);

        assertThat(pageResponse.getItems()).isEmpty();
        assertThat(pageResponse.getTotalElements()).isEqualTo(0);
        assertThat(pageResponse.getTotalPages()).isEqualTo(0);
        assertThat(pageResponse.isFirst()).isTrue();
        assertThat(pageResponse.isLast()).isTrue();

        String json = objectMapper.writeValueAsString(pageResponse);
        assertThat(json).contains("\"items\":[]");
        assertThat(json).contains("\"totalElements\":0");
    }
}
