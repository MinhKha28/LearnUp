"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceNotFoundException = void 0;
const common_1 = require("@nestjs/common");
const base_exception_1 = require("./base.exception");
const error_codes_constant_1 = require("./error-codes.constant");
class ResourceNotFoundException extends base_exception_1.BaseException {
    constructor(resourceNameOrMessage, identifier) {
        const message = identifier
            ? `${resourceNameOrMessage} with identifier '${identifier}' was not found.`
            : resourceNameOrMessage;
        super(error_codes_constant_1.ErrorCode.RESOURCE_NOT_FOUND, message, common_1.HttpStatus.NOT_FOUND);
    }
}
exports.ResourceNotFoundException = ResourceNotFoundException;
//# sourceMappingURL=resource-not-found.exception.js.map