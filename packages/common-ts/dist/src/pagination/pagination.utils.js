"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationUtils = void 0;
const page_response_interface_1 = require("./page-response.interface");
const page_meta_interface_1 = require("./page-meta.interface");
class PaginationUtils {
    static DEFAULT_PAGE = 0;
    static DEFAULT_SIZE = 20;
    static MAX_SIZE = 100;
    static clampPage(page) {
        if (page === undefined || page === null) {
            return this.DEFAULT_PAGE;
        }
        const num = typeof page === 'string' ? parseInt(page, 10) : page;
        return isNaN(num) || num < 0 ? this.DEFAULT_PAGE : num;
    }
    static clampSize(size, defaultSize = this.DEFAULT_SIZE, maxSize = this.MAX_SIZE) {
        if (size === undefined || size === null) {
            return defaultSize;
        }
        const num = typeof size === 'string' ? parseInt(size, 10) : size;
        if (isNaN(num) || num <= 0) {
            return defaultSize;
        }
        return Math.min(num, maxSize);
    }
    static calculateOffset(page, size) {
        const safePage = this.clampPage(page);
        const safeSize = this.clampSize(size);
        return safePage * safeSize;
    }
    static createMeta(page, size, totalElements) {
        return (0, page_meta_interface_1.createPageMeta)(this.clampPage(page), this.clampSize(size), totalElements);
    }
    static paginateArray(items, page, size) {
        if (!items || !Array.isArray(items) || items.length === 0) {
            return (0, page_response_interface_1.createPageResponse)([], this.clampPage(page), this.clampSize(size), 0);
        }
        const safePage = this.clampPage(page);
        const safeSize = this.clampSize(size);
        const totalElements = items.length;
        const fromIndex = safePage * safeSize;
        if (fromIndex >= totalElements) {
            return (0, page_response_interface_1.createPageResponse)([], safePage, safeSize, totalElements);
        }
        const toIndex = Math.min(fromIndex + safeSize, totalElements);
        const paginatedItems = items.slice(fromIndex, toIndex);
        return (0, page_response_interface_1.createPageResponse)(paginatedItems, safePage, safeSize, totalElements);
    }
}
exports.PaginationUtils = PaginationUtils;
//# sourceMappingURL=pagination.utils.js.map