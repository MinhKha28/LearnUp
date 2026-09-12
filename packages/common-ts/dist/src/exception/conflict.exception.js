"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictException = void 0;
const common_1 = require("@nestjs/common");
const base_exception_1 = require("./base.exception");
const error_codes_constant_1 = require("./error-codes.constant");
class ConflictException extends base_exception_1.BaseException {
    constructor(resourceNameOrMessage, field, value) {
        const message = field && value
            ? `${resourceNameOrMessage} with ${field} '${value}' already exists.`
            : resourceNameOrMessage;
        super(error_codes_constant_1.ErrorCode.CONFLICT, message, common_1.HttpStatus.CONFLICT);
    }
}
exports.ConflictException = ConflictException;
//# sourceMappingURL=conflict.exception.js.map