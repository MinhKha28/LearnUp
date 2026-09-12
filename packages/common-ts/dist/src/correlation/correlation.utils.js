"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCorrelationId = generateCorrelationId;
exports.extractOrGenerateCorrelationId = extractOrGenerateCorrelationId;
const uuid_1 = require("uuid");
const header_constants_1 = require("../context/header.constants");
function generateCorrelationId() {
    return (0, uuid_1.v4)();
}
function extractOrGenerateCorrelationId(headers) {
    if (!headers) {
        return generateCorrelationId();
    }
    const headerVal = headers[header_constants_1.HeaderConstants.X_CORRELATION_ID] ||
        headers[header_constants_1.HeaderConstants.X_CORRELATION_ID.toLowerCase()] ||
        headers['x-correlation-id'];
    if (headerVal) {
        return Array.isArray(headerVal) ? headerVal[0] : headerVal;
    }
    return generateCorrelationId();
}
//# sourceMappingURL=correlation.utils.js.map