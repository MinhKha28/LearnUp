"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorrelationMiddleware = void 0;
const common_1 = require("@nestjs/common");
const correlation_utils_1 = require("../../core/correlation/correlation-utils");
const headers_constant_1 = require("../../core/constants/headers.constant");
let CorrelationMiddleware = class CorrelationMiddleware {
    use(req, res, next) {
        const correlationId = (0, correlation_utils_1.extractOrGenerateCorrelationId)(req.headers);
        req.headers[headers_constant_1.HeaderConstants.X_CORRELATION_ID] = correlationId;
        res.setHeader(headers_constant_1.HeaderConstants.X_CORRELATION_ID, correlationId);
        next();
    }
};
exports.CorrelationMiddleware = CorrelationMiddleware;
exports.CorrelationMiddleware = CorrelationMiddleware = __decorate([
    (0, common_1.Injectable)()
], CorrelationMiddleware);
//# sourceMappingURL=correlation.middleware.js.map