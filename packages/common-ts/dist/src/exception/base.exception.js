"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseException = void 0;
const common_1 = require("@nestjs/common");
class BaseException extends common_1.HttpException {
    errorCode;
    details;
    constructor(errorCode, message, status, details) {
        super({
            code: errorCode,
            message,
            details: details ?? null,
        }, status);
        this.errorCode = errorCode;
        this.details = details ?? null;
    }
}
exports.BaseException = BaseException;
//# sourceMappingURL=base.exception.js.map