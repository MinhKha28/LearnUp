"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPageResponse = createPageResponse;
const page_meta_interface_1 = require("./page-meta.interface");
function createPageResponse(items, page, size, totalElements) {
    return {
        items: Array.isArray(items) ? items : [],
        meta: (0, page_meta_interface_1.createPageMeta)(page, size, totalElements),
    };
}
//# sourceMappingURL=page-response.interface.js.map