"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPageMeta = createPageMeta;
function createPageMeta(page, size, totalElements) {
    const safePage = page < 0 ? 0 : page;
    const safeSize = size <= 0 ? 20 : size;
    const safeTotal = totalElements < 0 ? 0 : totalElements;
    const totalPages = safeSize === 0 ? 1 : Math.ceil(safeTotal / safeSize);
    return {
        page: safePage,
        size: safeSize,
        totalElements: safeTotal,
        totalPages,
        hasNext: safePage + 1 < totalPages,
        hasPrevious: safePage > 0 && totalPages > 0,
    };
}
//# sourceMappingURL=page-meta.interface.js.map