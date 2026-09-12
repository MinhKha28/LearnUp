"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForbiddenException = void 0;
const common_1 = require("@nestjs/common");
const base_exception_1 = require("./base.exception");
const error_codes_constant_1 = require("./error-codes.constant");
class ForbiddenException extends base_exception_1.BaseException {
    constructor(message = 'Access denied.', requiredRole) {
        const finalMessage = requiredRole
            ? `${message} (Required role: ${requiredRole})`
            : message;
        super(error_codes_constant_1.ErrorCode.FORBIDDEN, finalMessage, common_1.HttpStatus.FORBIDDEN);
    }
}
exports.ForbiddenException = ForbiddenException;
//# sourceMappingURL=forbidden.exception.js.map