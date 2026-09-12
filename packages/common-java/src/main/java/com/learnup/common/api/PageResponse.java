package com.learnup.common.api;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Collections;
import java.util.List;

/**
 * Convenience wrapper for paginated items with metadata.
 *
 * @param <T> Item entity type
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PageResponse<T> {

    @Builder.Default
    private List<T> items = Collections.emptyList();

    private PageMeta meta;

    public static <T> PageResponse<T> of(List<T> items, int page, int size, long totalElements) {
        return PageResponse.<T>builder()
                .items(items != null ? items : Collections.emptyList())
                .meta(PageMeta.of(page, size, totalElements))
                .build();
    }
}
