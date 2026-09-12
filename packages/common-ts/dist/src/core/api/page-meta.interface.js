"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPageMeta = createPageMeta;
function createPageMeta(page, size, totalElements) {
    const totalPages = size === 0 ? 1 : Math.ceil(totalElements / size);
    return {
        page,
        size,
        totalElements,
        totalPages,
        hasNext: page + 1 < totalPages,
        hasPrevious: page > 0 && totalPages > 0,
    };
}
//# sourceMappingURL=page-meta.interface.js.map