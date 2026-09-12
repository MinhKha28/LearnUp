"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSuccessResponse = createSuccessResponse;
exports.createErrorResponse = createErrorResponse;
function createSuccessResponse(data, meta) {
    return {
        success: true,
        data: data !== undefined ? data : null,
        meta: meta ?? null,
        error: null,
        timestamp: new Date().toISOString(),
    };
}
function createErrorResponse(error) {
    return {
        success: false,
        data: null,
        meta: null,
        error,
        timestamp: new Date().toISOString(),
    };
}
//# sourceMappingURL=api-response.interface.js.map