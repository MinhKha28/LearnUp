package com.learnup.common.api;

import java.util.Collections;
import java.util.List;

/**
 * Reusable utility methods for pagination calculations and response mapping.
 */
public final class PaginationUtils {

    public static final int DEFAULT_PAGE = 0;
    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 100;

    private PaginationUtils() {
        // Prevent instantiation
    }

    /**
     * Sanitizes and clamps the page index (guarantees >= 0).
     */
    public static int clampPage(Integer page) {
        if (page == null || page < 0) {
            return DEFAULT_PAGE;
        }
        return page;
    }

    /**
     * Sanitizes and clamps the page size between 1 and MAX_SIZE.
     */
    public static int clampSize(Integer size) {
        return clampSize(size, DEFAULT_SIZE, MAX_SIZE);
    }

    /**
     * Sanitizes and clamps the page size between 1 and specified maxSize.
     */
    public static int clampSize(Integer size, int defaultSize, int maxSize) {
        if (size == null || size <= 0) {
            return defaultSize;
        }
        if (size > maxSize) {
            return maxSize;
        }
        return size;
    }

    /**
     * Calculates the database offset (0-indexed) for SQL / query construction.
     */
    public static long calculateOffset(int page, int size) {
        int safePage = clampPage(page);
        int safeSize = clampSize(size);
        return (long) safePage * (long) safeSize;
    }

    /**
     * Creates standard PageMeta.
     */
    public static PageMeta createPageMeta(int page, int size, long totalElements) {
        return PageMeta.of(clampPage(page), clampSize(size), Math.max(0, totalElements));
    }

    /**
     * Creates standard PageResponse.
     */
    public static <T> PageResponse<T> createPageResponse(List<T> items, int page, int size, long totalElements) {
        List<T> safeItems = items != null ? items : Collections.emptyList();
        PageMeta meta = createPageMeta(page, size, totalElements);
        return PageResponse.<T>builder()
                .items(safeItems)
                .meta(meta)
                .build();
    }

    /**
     * Extracts a paginated sublist from an in-memory list and wraps it in a PageResponse.
     */
    public static <T> PageResponse<T> paginateList(List<T> sourceList, int page, int size) {
        if (sourceList == null || sourceList.isEmpty()) {
            return createPageResponse(Collections.emptyList(), page, size, 0);
        }

        int safePage = clampPage(page);
        int safeSize = clampSize(size);
        long totalElements = sourceList.size();

        int fromIndex = (int) calculateOffset(safePage, safeSize);
        if (fromIndex >= sourceList.size()) {
            return createPageResponse(Collections.emptyList(), safePage, safeSize, totalElements);
        }

        int toIndex = Math.min(fromIndex + safeSize, sourceList.size());
        List<T> pageItems = sourceList.subList(fromIndex, toIndex);

        return createPageResponse(pageItems, safePage, safeSize, totalElements);
    }
}
