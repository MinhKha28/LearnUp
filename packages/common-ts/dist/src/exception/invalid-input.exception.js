"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidInputException = void 0;
const common_1 = require("@nestjs/common");
const base_exception_1 = require("./base.exception");
const error_codes_constant_1 = require("./error-codes.constant");
class InvalidInputException extends base_exception_1.BaseException {
    constructor(message = 'Invalid input provided.', details) {
        super(error_codes_constant_1.ErrorCode.INVALID_INPUT, message, common_1.HttpStatus.BAD_REQUEST, details);
    }
}
exports.InvalidInputException = InvalidInputException;
//# sourceMappingURL=invalid-input.exception.js.map