"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCorrelationId = generateCorrelationId;
exports.extractOrGenerateCorrelationId = extractOrGenerateCorrelationId;
const uuid_1 = require("uuid");
const headers_constant_1 = require("../constants/headers.constant");
function generateCorrelationId() {
    return (0, uuid_1.v4)();
}
function extractOrGenerateCorrelationId(headers) {
    const headerVal = headers[headers_constant_1.HeaderConstants.X_CORRELATION_ID] || headers['x-correlation-id'];
    if (headerVal) {
        return Array.isArray(headerVal) ? headerVal[0] : headerVal;
    }
    return generateCorrelationId();
}
//# sourceMappingURL=correlation-utils.js.map