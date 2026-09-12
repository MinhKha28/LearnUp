"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnauthorizedException = void 0;
const common_1 = require("@nestjs/common");
const base_exception_1 = require("./base.exception");
const error_codes_constant_1 = require("./error-codes.constant");
class UnauthorizedException extends base_exception_1.BaseException {
    constructor(message = 'Authentication required.') {
        super(error_codes_constant_1.ErrorCode.UNAUTHORIZED, message, common_1.HttpStatus.UNAUTHORIZED);
    }
}
exports.UnauthorizedException = UnauthorizedException;
//# sourceMappingURL=unauthorized.exception.js.map