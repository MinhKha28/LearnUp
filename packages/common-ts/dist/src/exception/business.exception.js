"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessException = void 0;
const common_1 = require("@nestjs/common");
const base_exception_1 = require("./base.exception");
const error_codes_constant_1 = require("./error-codes.constant");
class BusinessException extends base_exception_1.BaseException {
    constructor(message, errorCode = error_codes_constant_1.ErrorCode.INVALID_INPUT, details) {
        super(errorCode, message, common_1.HttpStatus.BAD_REQUEST, details);
    }
}
exports.BusinessException = BusinessException;
//# sourceMappingURL=business.exception.js.map