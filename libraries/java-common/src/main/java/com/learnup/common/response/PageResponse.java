package com.learnup.common.response;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Standard simple pagination response model for paginated API results.
 * Cursor pagination is explicitly not used.
 *
 * @param <T> Item element type
 */
public class PageResponse<T> {

    private final List<T> items;
    private final int page;
    private final int size;
    private final long totalElements;
    private final int totalPages;
    private final boolean first;
    private final boolean last;

    @JsonCreator
    public PageResponse(
            @JsonProperty("items") List<T> items,
            @JsonProperty("page") int page,
            @JsonProperty("size") int size,
            @JsonProperty("totalElements") long totalElements,
            @JsonProperty("totalPages") int totalPages,
            @JsonProperty("first") boolean first,
            @JsonProperty("last") boolean last) {
        this.items = items != null ? List.copyOf(items) : Collections.emptyList();
        this.page = page;
        this.size = size;
        this.totalElements = totalElements;
        this.totalPages = totalPages;
        this.first = first;
        this.last = last;
    }

    /**
     * Factory method computing totalPages, first, and last from page, size, and totalElements.
     *
     * @param items list of items for current page
     * @param page 0-indexed current page number
     * @param size page size (number of items per page)
     * @param totalElements total number of elements across all pages
     * @param <T> element type
     * @return computed PageResponse instance
     */
    public static <T> PageResponse<T> of(List<T> items, int page, int size, long totalElements) {
        int effectiveSize = size > 0 ? size : 20;
        int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / (double) effectiveSize);
        boolean first = page <= 0;
        boolean last = totalPages == 0 || page >= totalPages - 1;

        return new PageResponse<>(items, page, effectiveSize, totalElements, totalPages, first, last);
    }

    public static <T> PageResponse<T> empty(int page, int size) {
        return of(Collections.emptyList(), page, size, 0);
    }

    public List<T> getItems() {
        return items;
    }

    public int getPage() {
        return page;
    }

    public int getSize() {
        return size;
    }

    public long getTotalElements() {
        return totalElements;
    }

    public int getTotalPages() {
        return totalPages;
    }

    public boolean isFirst() {
        return first;
    }

    public boolean isLast() {
        return last;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PageResponse<?> that = (PageResponse<?>) o;
        return page == that.page &&
               size == that.size &&
               totalElements == that.totalElements &&
               totalPages == that.totalPages &&
               first == that.first &&
               last == that.last &&
               Objects.equals(items, that.items);
    }

    @Override
    public int hashCode() {
        return Objects.hash(items, page, size, totalElements, totalPages, first, last);
    }

    @Override
    public String toString() {
        return "PageResponse{" +
               "items=" + items.size() +
               ", page=" + page +
               ", size=" + size +
               ", totalElements=" + totalElements +
               ", totalPages=" + totalPages +
               ", first=" + first +
               ", last=" + last +
               '}';
    }
}
