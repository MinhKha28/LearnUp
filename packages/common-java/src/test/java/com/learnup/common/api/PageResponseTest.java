package com.learnup.common.api;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PageResponseTest {

    @Test
    @DisplayName("Should create PageResponse with items and meta")
    void shouldCreatePageResponse() {
        List<String> items = List.of("item1", "item2");
        PageResponse<String> response = PageResponse.of(items, 1, 10, 25);

        assertThat(response.getItems()).containsExactly("item1", "item2");
        assertThat(response.getMeta().getPage()).isEqualTo(1);
        assertThat(response.getMeta().getSize()).isEqualTo(10);
        assertThat(response.getMeta().getTotalElements()).isEqualTo(25);
        assertThat(response.getMeta().getTotalPages()).isEqualTo(3);
        assertThat(response.getMeta().isHasNext()).isTrue();
        assertThat(response.getMeta().isHasPrevious()).isTrue();
    }
}
