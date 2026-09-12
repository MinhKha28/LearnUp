package com.learnup.common.api;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PaginationUtilsTest {

    @Test
    @DisplayName("Should clamp page numbers correctly")
    void shouldClampPageNumbers() {
        assertThat(PaginationUtils.clampPage(null)).isEqualTo(0);
        assertThat(PaginationUtils.clampPage(-5)).isEqualTo(0);
        assertThat(PaginationUtils.clampPage(3)).isEqualTo(3);
    }

    @Test
    @DisplayName("Should clamp page size within bounds")
    void shouldClampPageSize() {
        assertThat(PaginationUtils.clampSize(null)).isEqualTo(20);
        assertThat(PaginationUtils.clampSize(0)).isEqualTo(20);
        assertThat(PaginationUtils.clampSize(-10)).isEqualTo(20);
        assertThat(PaginationUtils.clampSize(50)).isEqualTo(50);
        assertThat(PaginationUtils.clampSize(500)).isEqualTo(100);
    }

    @Test
    @DisplayName("Should calculate SQL offset accurately")
    void shouldCalculateOffset() {
        assertThat(PaginationUtils.calculateOffset(0, 20)).isEqualTo(0L);
        assertThat(PaginationUtils.calculateOffset(1, 20)).isEqualTo(20L);
        assertThat(PaginationUtils.calculateOffset(3, 25)).isEqualTo(75L);
    }

    @Test
    @DisplayName("Should paginate in-memory list correctly")
    void shouldPaginateList() {
        List<String> items = List.of("A", "B", "C", "D", "E", "F", "G");

        PageResponse<String> firstPage = PaginationUtils.paginateList(items, 0, 3);
        assertThat(firstPage.getItems()).containsExactly("A", "B", "C");
        assertThat(firstPage.getMeta().getPage()).isEqualTo(0);
        assertThat(firstPage.getMeta().getSize()).isEqualTo(3);
        assertThat(firstPage.getMeta().getTotalElements()).isEqualTo(7);
        assertThat(firstPage.getMeta().getTotalPages()).isEqualTo(3);
        assertThat(firstPage.getMeta().isHasNext()).isTrue();
        assertThat(firstPage.getMeta().isHasPrevious()).isFalse();

        PageResponse<String> lastPage = PaginationUtils.paginateList(items, 2, 3);
        assertThat(lastPage.getItems()).containsExactly("G");
        assertThat(lastPage.getMeta().isHasNext()).isFalse();
        assertThat(lastPage.getMeta().isHasPrevious()).isTrue();

        PageResponse<String> outOfBoundsPage = PaginationUtils.paginateList(items, 10, 3);
        assertThat(outOfBoundsPage.getItems()).isEmpty();
    }
}
